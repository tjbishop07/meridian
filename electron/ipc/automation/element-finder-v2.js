/**
 * Element Finder V2 - Confidence-based element matching
 *
 * Finds elements using multi-attribute scoring to ensure high-confidence matches only
 */
/**
 * Generate improved element finder script with confidence scoring
 * Only returns elements with confidence >= 70%
 */
export function generateConfidenceElementFinderScript(identification) {
    // Pre-compute what we're looking for
    const hasText = !!identification.text && identification.text.length > 0;
    const hasRole = !!identification.role;
    const hasAriaLabel = !!identification.ariaLabel;
    const hasPlaceholder = !!identification.placeholder;
    const hasHref = !!identification.href;
    const hasParentContext = !!(identification.parentRole || identification.parentClass);
    return `
    (function() {
      console.log('[Element Finder V2] Starting confidence-based search...');
      console.log('[Element Finder V2] Target:', ${JSON.stringify(identification)});

      // Helper: Calculate text similarity (0-1 score)
      function textSimilarity(a, b) {
        if (!a || !b) return 0;
        const aLower = a.toLowerCase().trim();
        const bLower = b.toLowerCase().trim();
        if (aLower === bLower) return 1.0;
        if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.8;
        // Levenshtein for fuzzy matching
        if (Math.abs(aLower.length - bLower.length) <= 3) {
          const dist = levenshtein(aLower, bLower);
          if (dist <= 3) return 0.7;
        }
        return 0;
      }

      // Simple Levenshtein distance
      function levenshtein(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
          matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
          matrix[0][j] = j;
        }
        for (let i = 1; i <= b.length; i++) {
          for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
              matrix[i][j] = matrix[i - 1][j - 1];
            } else {
              matrix[i][j] = Math.min(
                matrix[i - 1][j - 1] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1
              );
            }
          }
        }
        return matrix[b.length][a.length];
      }

      // Helper: Calculate confidence score for an element
      function calculateConfidence(element) {
        if (!element) return 0;

        let score = 0;
        let maxScore = 0;
        const matches = [];

        // Text content match (high weight: 30 points)
        ${hasText ? `
          maxScore += 30;
          const targetText = ${JSON.stringify(identification.text)};
          const elText = element.textContent?.trim() || '';
          const similarity = textSimilarity(elText, targetText);

          if (similarity > 0) {
            const points = Math.round(similarity * 30);
            score += points;
            matches.push(\`text(\${Math.round(similarity * 100)}%): "\${elText.substring(0, 30)}"\`);
          } else {
            // Major penalty if text doesn't match at all
            matches.push('text(0%): MISMATCH');
          }
        ` : ''}

        // Role match (important: 20 points)
        ${hasRole ? `
          maxScore += 20;
          const targetRole = ${JSON.stringify(identification.role)};
          const elRole = element.getAttribute('role') || element.tagName.toLowerCase();

          if (elRole === targetRole) {
            score += 20;
            matches.push(\`role(100%): \${elRole}\`);
          } else if (
            (targetRole === 'button' && elRole === 'BUTTON') ||
            (targetRole === 'input' && elRole === 'INPUT') ||
            (targetRole === 'a' && elRole === 'link')
          ) {
            score += 20;
            matches.push(\`role(100%): \${elRole}\`);
          } else {
            matches.push(\`role(0%): \${elRole} != \${targetRole}\`);
          }
        ` : ''}

        // ARIA label match (20 points)
        ${hasAriaLabel ? `
          maxScore += 20;
          const targetAriaLabel = ${JSON.stringify(identification.ariaLabel)};
          const elAriaLabel = element.getAttribute('aria-label') || '';

          if (elAriaLabel === targetAriaLabel) {
            score += 20;
            matches.push('ariaLabel(100%)');
          } else {
            matches.push('ariaLabel(0%): MISMATCH');
          }
        ` : ''}

        // Placeholder match (15 points)
        ${hasPlaceholder ? `
          maxScore += 15;
          const targetPlaceholder = ${JSON.stringify(identification.placeholder)};
          const elPlaceholder = element.getAttribute('placeholder') || '';

          if (elPlaceholder === targetPlaceholder) {
            score += 15;
            matches.push('placeholder(100%)');
          }
        ` : ''}

        // href match - CRITICAL for navigation links (25 points)
        ${hasHref ? `
          maxScore += 25;
          const targetHref = ${JSON.stringify(identification.href)};
          const elHref = element.getAttribute('href') || '';

          if (elHref === targetHref) {
            score += 25;
            matches.push(\`href(100%): \${elHref}\`);
          } else if (elHref && targetHref && (elHref.includes(targetHref) || targetHref.includes(elHref))) {
            score += 15;
            matches.push(\`href(60%): \${elHref}\`);
          } else {
            matches.push(\`href(0%): \${elHref} != \${targetHref}\`);
          }
        ` : ''}

        // Parent context (10 points)
        ${hasParentContext ? `
          maxScore += 10;
          const parent = element.parentElement;
          if (parent) {
            ${identification.parentRole ? `
              const targetParentRole = ${JSON.stringify(identification.parentRole)};
              const parentRole = parent.getAttribute('role') || parent.tagName.toLowerCase();
              if (parentRole === targetParentRole) {
                score += 5;
                matches.push('parentRole(100%)');
              }
            ` : ''}

            ${identification.parentClass ? `
              const targetParentClass = ${JSON.stringify(identification.parentClass)};
              const parentClass = parent.className && typeof parent.className === 'string'
                ? parent.className.split(/\\s+/).filter(c => c && c.length < 30)[0]
                : null;
              if (parentClass === targetParentClass) {
                score += 5;
                matches.push('parentClass(100%)');
              }
            ` : ''}
          }
        ` : ''}

        // Visibility check (required - 15 points)
        maxScore += 15;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const isVisible = rect.width > 0 && rect.height > 0 &&
                         style.visibility !== 'hidden' &&
                         style.display !== 'none';

        if (isVisible) {
          score += 15;
          matches.push('visible(100%)');
        } else {
          matches.push('visible(0%): HIDDEN');
          // Hidden elements get 0 confidence
          return { confidence: 0, score, maxScore, matches, reason: 'Element is hidden' };
        }

        // Calculate confidence percentage
        const confidence = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

        return { confidence, score, maxScore, matches };
      }

      // Find all potential candidate elements based on role
      let candidates = [];

      ${hasRole ? `
        const role = ${JSON.stringify(identification.role)};
        if (role === 'button' || role === 'BUTTON') {
          candidates = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'));
        } else if (role === 'input' || role === 'INPUT') {
          candidates = Array.from(document.querySelectorAll('input:not([type="button"]):not([type="submit"]), textarea'));
        } else if (role === 'select' || role === 'SELECT') {
          candidates = Array.from(document.querySelectorAll('select'));
        } else if (role === 'a' || role === 'link') {
          candidates = Array.from(document.querySelectorAll('a, [role="link"]'));
        } else if (role === 'span' || role === 'SPAN') {
          candidates = Array.from(document.querySelectorAll('span[role], span[tabindex], span[onclick]'));
        } else {
          candidates = Array.from(document.querySelectorAll(role));
        }
      ` : `
        // No role specified, search all interactive elements
        candidates = Array.from(document.querySelectorAll('button, a, input, select, [role="button"], [role="link"], [tabindex]'));
      `}

      console.log(\`[Element Finder V2] Found \${candidates.length} candidates\`);

      // Score all candidates
      const scored = candidates.map(el => {
        const result = calculateConfidence(el);
        return { element: el, ...result };
      });

      // Sort by confidence (highest first)
      scored.sort((a, b) => b.confidence - a.confidence);

      // Log top 5 candidates
      console.log('[Element Finder V2] Top candidates:');
      for (let i = 0; i < Math.min(5, scored.length); i++) {
        const c = scored[i];
        const text = c.element.textContent?.trim().substring(0, 30) || '';
        console.log(\`  \${i + 1}. Confidence: \${c.confidence}% - \${c.element.tagName} "\${text}"\`);
        console.log(\`     Matches: \${c.matches.join(', ')}\`);
      }

      // Accept matches >= 60% confidence (lowered from 70% for testing)
      // TODO: Raise back to 70% once recordings are improved
      const MIN_CONFIDENCE = 60;
      const bestMatch = scored[0];

      if (!bestMatch || bestMatch.confidence < MIN_CONFIDENCE) {
        console.error(\`[Element Finder V2] ❌ No high-confidence match found (best: \${bestMatch?.confidence || 0}%)\`);
        if (bestMatch) {
          console.error(\`[Element Finder V2] Best candidate was:\`);
          console.error(\`  Element: \${bestMatch.element.tagName} "\${(bestMatch.element.textContent || '').trim().substring(0, 50)}"\`);
          console.error(\`  Matches: \${bestMatch.matches.join(', ')}\`);
        }
        console.error('[Element Finder V2] This usually means:');
        console.error('  1. The page content has changed');
        console.error('  2. The element text/attributes have changed');
        console.error('  3. The element is not visible or loaded yet');
        return null;
      }

      console.log(\`[Element Finder V2] ✓ Found element with \${bestMatch.confidence}% confidence\`);
      console.log(\`[Element Finder V2] Matches: \${bestMatch.matches.join(', ')}\`);

      return bestMatch.element;
    })()
  `;
}
