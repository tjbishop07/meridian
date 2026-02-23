/**
 * Element Finder - Text-based element identification
 *
 * Finds elements using text content, ARIA labels, and other semantic attributes
 * instead of brittle selectors or coordinates.
 */
/**
 * Generate element identification data during recording
 * This runs in the browser context
 */
export function generateElementIdentificationScript(elementSelector) {
    return `
    (function() {
      const element = ${elementSelector};
      if (!element) return null;

      const rect = element.getBoundingClientRect();

      // Get text content (cleaned)
      let text = element.textContent?.trim() || '';
      if (text.length > 100) text = text.substring(0, 100); // Limit length

      // Get ARIA attributes
      const ariaLabel = element.getAttribute('aria-label') ||
                       element.getAttribute('aria-labelledby') &&
                       document.getElementById(element.getAttribute('aria-labelledby'))?.textContent?.trim();

      // Get other attributes
      const placeholder = element.getAttribute('placeholder');
      const title = element.getAttribute('title');
      const role = element.getAttribute('role') || element.tagName.toLowerCase();

      // Find nearby labels
      const nearbyLabels = [];
      const labels = document.querySelectorAll('label');
      for (const label of labels) {
        const labelRect = label.getBoundingClientRect();
        const distance = Math.abs(labelRect.top - rect.top) + Math.abs(labelRect.left - rect.left);
        if (distance < 200) { // Within 200px
          nearbyLabels.push(label.textContent?.trim());
        }
      }

      // Also check for label associated by 'for' attribute
      if (element.id) {
        const associatedLabel = document.querySelector(\`label[for="\${element.id}"]\`);
        if (associatedLabel) {
          nearbyLabels.push(associatedLabel.textContent?.trim());
        }
      }

      return {
        text,
        ariaLabel,
        placeholder,
        title,
        role,
        nearbyLabels: nearbyLabels.filter(l => l && l.length > 0),
        coordinates: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          elementX: rect.left + rect.width / 2,
          elementY: rect.top + rect.height / 2
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY
        }
      };
    })()
  `;
}
/**
 * Find element using text-based strategies
 * This script runs in the browser during playback
 */
export function generateElementFinderScript(identification) {
    return `
    (function() {
      console.log('[Element Finder] Searching for element with:', ${JSON.stringify(identification)});
      const strategiesAttempted = [];

      // Strategy 1: Find by text content + role
      if (${JSON.stringify(identification.text)} && ${JSON.stringify(identification.role)}) {
        strategiesAttempted.push('text+role');
        const text = ${JSON.stringify(identification.text)};
        const role = ${JSON.stringify(identification.role)};

        let elements;
        if (role === 'button' || role === 'BUTTON') {
          elements = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'));
        } else if (role === 'input' || role === 'INPUT') {
          elements = Array.from(document.querySelectorAll('input:not([type="button"]):not([type="submit"]), textarea'));
        } else if (role === 'select' || role === 'SELECT') {
          elements = Array.from(document.querySelectorAll('select'));
        } else if (role === 'a' || role === 'link') {
          elements = Array.from(document.querySelectorAll('a, [role="link"]'));
        } else {
          elements = Array.from(document.querySelectorAll(role));
        }

        console.log('[Element Finder] Strategy 1: Found', elements.length, 'elements with role', role);

        for (const el of elements) {
          // Check if element is visible
          if (el.offsetParent === null && el.tagName !== 'BODY') continue;

          const elText = el.textContent?.trim() || '';
          const placeholder = el.getAttribute?.('placeholder') || '';

          if (elText.includes(text) || text.includes(elText) || placeholder.includes(text)) {
            console.log('[Element Finder] ✓ Found by text + role:', el.tagName, placeholder || elText.substring(0, 30));
            window.__lastFinderDiag = { strategy: 'text+role', attempted: strategiesAttempted };
            return el;
          }
        }
        console.log('[Element Finder] Strategy 1 failed: No matching text found');
      }

      // Strategy 2: Find by aria-label
      if (${JSON.stringify(identification.ariaLabel)}) {
        strategiesAttempted.push('aria-label');
        const ariaLabel = ${JSON.stringify(identification.ariaLabel)};
        const element = document.querySelector(\`[aria-label="\${ariaLabel}"]\`) ||
                       document.querySelector(\`[aria-label*="\${ariaLabel}"]\`);
        if (element) {
          console.log('[Element Finder] ✓ Found by aria-label');
          window.__lastFinderDiag = { strategy: 'aria-label', attempted: strategiesAttempted };
          return element;
        }
        console.log('[Element Finder] Strategy 2 failed: No aria-label match');
      }

      // Strategy 3: Find by placeholder (for inputs)
      if (${JSON.stringify(identification.placeholder)}) {
        strategiesAttempted.push('placeholder');
        const placeholder = ${JSON.stringify(identification.placeholder)};
        const element = document.querySelector(\`[placeholder="\${placeholder}"]\`);
        if (element) {
          console.log('[Element Finder] ✓ Found by placeholder');
          window.__lastFinderDiag = { strategy: 'placeholder', attempted: strategiesAttempted };
          return element;
        }
        console.log('[Element Finder] Strategy 3 failed: No placeholder match');
      }

      // Strategy 4: Find by title
      if (${JSON.stringify(identification.title)}) {
        strategiesAttempted.push('title');
        const title = ${JSON.stringify(identification.title)};
        const element = document.querySelector(\`[title="\${title}"]\`);
        if (element) {
          console.log('[Element Finder] ✓ Found by title');
          window.__lastFinderDiag = { strategy: 'title', attempted: strategiesAttempted };
          return element;
        }
        console.log('[Element Finder] Strategy 4 failed: No title match');
      }

      // Strategy 5: Find by nearby label text
      if (${JSON.stringify(identification.nearbyLabels)} && ${JSON.stringify(identification.nearbyLabels)}.length > 0) {
        strategiesAttempted.push('nearby-labels');
        const nearbyLabels = ${JSON.stringify(identification.nearbyLabels)};
        for (const labelText of nearbyLabels) {
          const labels = Array.from(document.querySelectorAll('label'));
          for (const label of labels) {
            if (label.textContent?.trim().includes(labelText)) {
              // Found the label, now find associated input
              const forAttr = label.getAttribute('for');
              if (forAttr) {
                const element = document.getElementById(forAttr);
                if (element) {
                  console.log('[Element Finder] ✓ Found by nearby label:', labelText);
                  window.__lastFinderDiag = { strategy: 'nearby-labels', attempted: strategiesAttempted };
                  return element;
                }
              }
              // Or find input inside label
              const input = label.querySelector('input, textarea, select');
              if (input) {
                console.log('[Element Finder] ✓ Found input inside label:', labelText);
                window.__lastFinderDiag = { strategy: 'nearby-labels', attempted: strategiesAttempted };
                return input;
              }
            }
          }
        }
        console.log('[Element Finder] Strategy 5 failed: No nearby label match');
      }

      // Strategy 6: Fuzzy text matching (for when text changes slightly)
      if (${JSON.stringify(identification.text)}) {
        strategiesAttempted.push('fuzzy-text');
        const targetText = ${JSON.stringify(identification.text)}.toLowerCase();
        const role = ${JSON.stringify(identification.role)};

        // Levenshtein distance for fuzzy matching
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

        function similarity(a, b) {
          const maxLen = Math.max(a.length, b.length);
          if (maxLen === 0) return 1;
          const distance = levenshtein(a, b);
          return 1 - distance / maxLen;
        }

        // Find all interactive elements
        let candidates;
        if (role === 'button' || role === 'BUTTON') {
          candidates = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], a'));
        } else if (role === 'input' || role === 'INPUT') {
          candidates = Array.from(document.querySelectorAll('input, textarea'));
        } else {
          candidates = Array.from(document.querySelectorAll('button, a, input, [role="button"]'));
        }

        console.log('[Element Finder] Strategy 6: Checking', candidates.length, 'candidates for fuzzy match');

        let bestMatch = null;
        let bestScore = 0.75; // Minimum 75% similarity threshold

        for (const el of candidates) {
          if (el.offsetParent === null && el.tagName !== 'BODY') continue; // Skip hidden elements

          const elText = (el.textContent?.trim() || '').toLowerCase();
          const placeholder = (el.getAttribute?.('placeholder') || '').toLowerCase();
          const ariaLabel = (el.getAttribute?.('aria-label') || '').toLowerCase();

          const texts = [elText, placeholder, ariaLabel].filter(t => t.length > 0);

          for (const text of texts) {
            const score = similarity(targetText, text);
            if (score > bestScore) {
              bestScore = score;
              bestMatch = el;
            }
          }
        }

        if (bestMatch) {
          console.log('[Element Finder] ✓ Found by fuzzy matching with', Math.round(bestScore * 100) + '% similarity');
          window.__lastFinderDiag = { strategy: 'fuzzy-text', attempted: strategiesAttempted };
          return bestMatch;
        }
        console.log('[Element Finder] Strategy 6 failed: No fuzzy match above threshold');
      }

      // Strategy 7: Fallback to coordinates
      if (${JSON.stringify(identification.coordinates)}) {
        strategiesAttempted.push('coordinates');
        const coords = ${JSON.stringify(identification.coordinates)};
        const expectedRole = ${JSON.stringify(identification.role)};
        console.log('[Element Finder] ⚠️ Falling back to coordinates for', expectedRole);

        const strategies = [
          { x: coords.x, y: coords.y, name: 'exact' },
          { x: coords.elementX || coords.x, y: coords.elementY || coords.y, name: 'element center' }
        ];

        for (const strategy of strategies) {
          let element = document.elementFromPoint(strategy.x, strategy.y);

          if (element && element.tagName !== 'HTML' && element.tagName !== 'BODY') {
            // Check if we found the right element type
            const isCorrectType = (
              (expectedRole === 'input' && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) ||
              (expectedRole === 'select' && element.tagName === 'SELECT') ||
              (expectedRole === 'button' && (element.tagName === 'BUTTON' || element.type === 'submit')) ||
              (!expectedRole) // No expected type, accept anything
            );

            if (isCorrectType) {
              console.log('[Element Finder] ✓ Found correct element by coordinates:', element.tagName);
              window.__lastFinderDiag = { strategy: 'coordinates', attempted: strategiesAttempted };
              return element;
            }

            // If wrong type, try to find the correct type as a child or nearby
            if (expectedRole === 'input') {
              const input = element.querySelector('input, textarea');
              if (input) {
                console.log('[Element Finder] ✓ Found input inside', element.tagName);
                window.__lastFinderDiag = { strategy: 'coordinates-child', attempted: strategiesAttempted };
                return input;
              }
            } else if (expectedRole === 'select') {
              const select = element.querySelector('select');
              if (select) {
                console.log('[Element Finder] ✓ Found select inside', element.tagName);
                window.__lastFinderDiag = { strategy: 'coordinates-child', attempted: strategiesAttempted };
                return select;
              }
            } else if (expectedRole === 'button') {
              const button = element.querySelector('button, input[type="submit"]');
              if (button) {
                console.log('[Element Finder] ✓ Found button inside', element.tagName);
                window.__lastFinderDiag = { strategy: 'coordinates-child', attempted: strategiesAttempted };
                return button;
              }
            }

            console.log('[Element Finder] ⚠️ Found', element.tagName, 'but expected', expectedRole);
          }
        }
        console.log('[Element Finder] Strategy 7 failed: No coordinate match');
      }

      // Strategy 8: Search in iframes
      strategiesAttempted.push('iframes');
      console.log('[Element Finder] Checking iframes...');

      const iframes = document.querySelectorAll('iframe');
      console.log('[Element Finder] Found', iframes.length, 'iframes');

      for (const iframe of iframes) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDoc) {
            console.log('[Element Finder] Cannot access iframe (cross-origin?)');
            continue;
          }

          console.log('[Element Finder] Searching iframe:', iframe.src || iframe.id || 'unnamed');

          // Try text + role in iframe
          if (${JSON.stringify(identification.text)} && ${JSON.stringify(identification.role)}) {
            const text = ${JSON.stringify(identification.text)};
            const role = ${JSON.stringify(identification.role)};

            let elements;
            if (role === 'input' || role === 'INPUT') {
              elements = Array.from(iframeDoc.querySelectorAll('input:not([type="button"]):not([type="submit"]), textarea'));
            } else if (role === 'button' || role === 'BUTTON') {
              elements = Array.from(iframeDoc.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]'));
            } else {
              elements = Array.from(iframeDoc.querySelectorAll(role));
            }

            for (const el of elements) {
              if (el.offsetParent === null && el.tagName !== 'BODY') continue;
              const elText = el.textContent?.trim() || '';
              const placeholder = el.getAttribute?.('placeholder') || '';

              if (elText.includes(text) || text.includes(elText) || placeholder.includes(text)) {
                console.log('[Element Finder] ✓ Found in iframe by text + role:', el.tagName);
                window.__lastFinderDiag = { strategy: 'iframe-text+role', attempted: strategiesAttempted };
                return el;
              }
            }
          }

          // Try placeholder in iframe
          if (${JSON.stringify(identification.placeholder)}) {
            const placeholder = ${JSON.stringify(identification.placeholder)};
            const element = iframeDoc.querySelector(\`[placeholder="\${placeholder}"]\`);
            if (element) {
              console.log('[Element Finder] ✓ Found in iframe by placeholder');
              window.__lastFinderDiag = { strategy: 'iframe-placeholder', attempted: strategiesAttempted };
              return element;
            }
          }

          // Try to find any visible input in iframe (last resort)
          if (${JSON.stringify(identification.role)} === 'input' || ${JSON.stringify(identification.role)} === 'INPUT') {
            const inputs = iframeDoc.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea');
            const visibleInputs = Array.from(inputs).filter(el => el.offsetParent !== null);

            if (visibleInputs.length > 0) {
              console.log('[Element Finder] ⚠️ Found', visibleInputs.length, 'visible input(s) in iframe, using first one');
              window.__lastFinderDiag = { strategy: 'iframe-first-visible-input', attempted: strategiesAttempted };
              return visibleInputs[0];
            }
          }
        } catch (err) {
          console.log('[Element Finder] Error accessing iframe:', err.message);
        }
      }

      console.log('[Element Finder] Strategy 8 failed: No element found in iframes');

      // Strategy 9: Partial text match (case-insensitive, more lenient)
      if (${JSON.stringify(identification.text)}) {
        strategiesAttempted.push('partial-text');
        const targetText = ${JSON.stringify(identification.text)}.toLowerCase().trim();
        const role = ${JSON.stringify(identification.role)};

        console.log('[Element Finder] Strategy 9: Trying partial text match for:', targetText);

        let candidates;
        if (role === 'button' || role === 'BUTTON' || role === 'a') {
          candidates = Array.from(document.querySelectorAll('a, button, [role="button"], [role="link"], input[type="button"], input[type="submit"]'));
        } else {
          candidates = Array.from(document.querySelectorAll('*'));
        }

        for (const el of candidates) {
          if (el.offsetParent === null && el.tagName !== 'BODY') continue;

          const elText = (el.textContent || '').toLowerCase().trim();

          // More lenient matching: partial, case-insensitive
          if (elText.includes(targetText) || targetText.includes(elText)) {
            // Additional check: make sure it's a reasonable match (not too short)
            if (elText.length >= 3 && targetText.length >= 3) {
              console.log('[Element Finder] ✓ Found by partial text match:', el.tagName, elText.substring(0, 50));
              window.__lastFinderDiag = { strategy: 'partial-text', attempted: strategiesAttempted };
              return el;
            }
          }
        }

        console.log('[Element Finder] Strategy 9 failed: No partial match');
      }

      // Before giving up, log what's actually on the page to help debug
      const targetText = ${JSON.stringify(identification.text)};
      if (targetText) {
        console.log('[Element Finder] ✗ Could not find element with text:', targetText);
        console.log('[Element Finder] Searching for similar elements...');

        // Find all clickable elements and their text
        const allClickable = document.querySelectorAll('a, button, [role="button"], [role="link"]');
        const visible = Array.from(allClickable)
          .filter(el => el.offsetParent !== null)
          .map(el => ({
            tag: el.tagName,
            text: (el.textContent || '').trim().substring(0, 50),
            classes: el.className
          }))
          .filter(el => el.text.length > 0);

        console.log('[Element Finder] Found', visible.length, 'visible clickable elements');

        // Show first 10 for debugging
        visible.slice(0, 10).forEach((el, i) => {
          console.log(\`  [\${i+1}] \${el.tag}: "\${el.text}"\`);
        });

        // Look for partial matches
        const targetLower = targetText.toLowerCase();
        const partialMatches = visible.filter(el =>
          el.text.toLowerCase().includes(targetLower) ||
          targetLower.includes(el.text.toLowerCase())
        );

        if (partialMatches.length > 0) {
          console.log('[Element Finder] 💡 Found', partialMatches.length, 'partial match(es):');
          partialMatches.forEach(match => {
            console.log(\`  → \${match.tag}: "\${match.text}"\`);
          });
        }
      }

      console.log('[Element Finder] ✗ Could not find element. Strategies attempted:', strategiesAttempted);
      window.__lastFinderDiag = { strategy: 'none', attempted: strategiesAttempted };
      return null;
    })()
  `;
}
/**
 * Extract element identification from a step
 * For backward compatibility with old recordings
 */
export function extractIdentification(step) {
    // New format
    if (step.identification) {
        return step.identification;
    }
    // Old format (coordinates only)
    return {
        coordinates: step.coordinates,
        viewport: step.viewport,
    };
}
