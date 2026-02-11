import { ipcMain, BrowserWindow, app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

let scraperWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let currentAccountId: number | null = null;

export function setMainWindow(window: BrowserWindow) {
  mainWindow = window;
}

export function registerScraperHandlers() {
  // Open browser for manual scraping
  ipcMain.handle('scraper:open-browser', async (_, options: { accountId: number; startUrl?: string }) => {
    try {
      currentAccountId = options.accountId;

      // Close existing window if any
      if (scraperWindow && !scraperWindow.isDestroyed()) {
        scraperWindow.close();
      }

      // Create browser window with preload script
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      // In dev: dist-electron/ipc/scraper.js -> dist-electron/scraper-preload.cjs
      let preloadPath = path.join(__dirname, '..', 'scraper-preload.cjs');

      // Check if file exists, try alternate path if not
      const fs = await import('fs');
      if (!fs.existsSync(preloadPath)) {
        console.warn('[Scraper] Preload not found at:', preloadPath);
        // Try app path
        preloadPath = path.join(app.getAppPath(), 'dist-electron', 'scraper-preload.cjs');
        console.log('[Scraper] Trying alternate path:', preloadPath);

        if (!fs.existsSync(preloadPath)) {
          console.error('[Scraper] Preload file not found at either location!');
          throw new Error('Scraper preload file not found');
        }
      }

      console.log('[Scraper] Using preload path:', preloadPath);

      scraperWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'Manual Transaction Scraper',
        backgroundColor: '#1f2937',
        webPreferences: {
          preload: preloadPath,
          partition: 'persist:scraper',
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
          webSecurity: true,
        },
      });

      // Set realistic user agent
      const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      scraperWindow.webContents.setUserAgent(userAgent);

      // Load start URL or blank page
      const startUrl = options.startUrl || 'about:blank';
      await scraperWindow.loadURL(startUrl);

      // Verify preload loaded
      scraperWindow.webContents.on('dom-ready', async () => {
        const hasApi = await scraperWindow!.webContents.executeJavaScript(
          'typeof window.scraper !== "undefined"'
        );
        console.log('[Scraper] Preload API available:', hasApi);
      });

      // Inject scraper controls overlay
      scraperWindow.webContents.on('did-finish-load', async () => {
        await injectScraperControls(scraperWindow!);
      });

      scraperWindow.webContents.on('did-navigate', async () => {
        await injectScraperControls(scraperWindow!);
      });

      scraperWindow.webContents.on('did-navigate-in-page', async () => {
        await injectScraperControls(scraperWindow!);
      });

      // Clean up on close
      scraperWindow.on('closed', () => {
        scraperWindow = null;
        currentAccountId = null;
      });

      return { success: true };
    } catch (error) {
      console.error('[Scraper] Failed to open browser:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Execute scrape on current page
  ipcMain.on('scraper:execute', async () => {
    if (!scraperWindow || scraperWindow.isDestroyed()) {
      console.error('[Scraper] No scraper window open');
      return;
    }

    if (!currentAccountId) {
      console.error('[Scraper] No account selected');
      return;
    }

    try {
      console.log('[Scraper] Starting scrape...');

      // Execute scraping script
      const transactions = await scraperWindow.webContents.executeJavaScript(getScrapeScript());

      console.log('[Scraper] Scraped', transactions.length, 'transactions');

      if (transactions.length === 0) {
        // Show error in scraper window
        await scraperWindow.webContents.executeJavaScript(`
          alert('No transactions found on this page. Make sure you\\'re on the transactions page.');
        `);
        return;
      }

      // Send transactions to main window for preview/import
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scraper:transactions-found', {
          accountId: currentAccountId,
          transactions,
        });
      }

      // Close scraper window
      scraperWindow.close();

    } catch (error) {
      console.error('[Scraper] Scrape failed:', error);
      await scraperWindow.webContents.executeJavaScript(`
        alert('Failed to scrape transactions: ${error instanceof Error ? error.message : 'Unknown error'}');
      `);
    }
  });
}

// Inject floating "Scrape This Page" button
async function injectScraperControls(window: BrowserWindow) {
  if (!window || window.isDestroyed()) return;

  const controlsCode = `
    (function() {
      // Don't inject on about:blank
      if (window.location.href === 'about:blank') return;

      // Check if already injected
      if (document.getElementById('scraper-controls')) return;

      const controls = document.createElement('div');
      controls.id = 'scraper-controls';
      controls.innerHTML = \`
        <style>
          #scraper-controls {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }

          #scraper-controls button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 16px 24px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
          }

          #scraper-controls button:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 35px rgba(102, 126, 234, 0.5);
          }

          #scraper-controls button:active {
            transform: translateY(0px);
          }
        </style>
        <button id="scrape-button">
          📊 Scrape This Page
        </button>
      \`;

      document.body.appendChild(controls);

      // Handle button click
      document.getElementById('scrape-button').addEventListener('click', () => {
        if (window.scraper && window.scraper.executeScrape) {
          window.scraper.executeScrape();
        } else {
          alert('Scraper API not available. Please restart the browser window.');
        }
      });
    })();
  `;

  try {
    await window.webContents.executeJavaScript(controlsCode);
  } catch (error) {
    console.error('[Scraper] Failed to inject controls:', error);
  }
}

// Intelligent pattern recognition scraper
function getScrapeScript() {
  return `
    (function() {
      console.log('[Scraper] 🔍 Starting intelligent extraction...');

      // ===== PATTERN RECOGNITION UTILITIES =====

      // Detect if text contains a monetary amount
      function isMoneyValue(text) {
        if (!text) return false;
        const cleaned = text.replace(/[,\\s]/g, '');
        return /^-?\\$?\\d+\\.?\\d{0,2}$/.test(cleaned) ||
               /^-?\\d+\\.?\\d{0,2}$/.test(cleaned);
      }

      // Extract numeric value from money string
      function parseMoneyValue(text) {
        if (!text) return null;
        const cleaned = text.replace(/[$,\\s]/g, '');
        const value = parseFloat(cleaned);
        return isNaN(value) ? null : value;
      }

      // Detect if text contains a date
      function isDateValue(text) {
        if (!text || text.length < 6 || text.length > 30) return false;

        // Common date patterns
        const datePatterns = [
          /\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4}/,  // MM/DD/YYYY or DD/MM/YYYY
          /\\d{4}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{1,2}/,    // YYYY-MM-DD
          /\\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+\\d{1,2}[,\\s]+\\d{4}/i,  // Month DD, YYYY
          /\\d{1,2}\\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+\\d{4}/i,  // DD Month YYYY
        ];

        return datePatterns.some(pattern => pattern.test(text));
      }

      // Score how "transaction-like" a container is
      function scoreTransactionLikelihood(element) {
        let score = 0;
        const text = element.innerText || element.textContent || '';

        // Check for money values (visible text only)
        const moneyMatches = text.match(/\\$?\\d+\\.\\d{2}/g) || [];
        score += moneyMatches.length * 10;

        // Bonus for having both amount and balance
        if (moneyMatches.length >= 2) score += 5;

        // Check for dates
        if (isDateValue(text)) score += 15;

        // Check for transaction-related keywords in classes/IDs
        const classAndId = (element.className + ' ' + element.id).toLowerCase();
        if (classAndId.includes('transaction')) score += 20;
        if (classAndId.includes('activity')) score += 15;
        if (classAndId.includes('payment')) score += 15;
        if (classAndId.includes('row')) score += 5;
        if (classAndId.includes('item')) score += 5;

        // Check for amount/debit/credit classes (indicates transaction row)
        if (classAndId.includes('amount') || classAndId.includes('debit') || classAndId.includes('credit')) {
          score += 10;
        }

        // Check structure
        const children = element.children.length;
        if (children >= 3 && children <= 10) score += 10;

        return score;
      }

      // Find repeating patterns (siblings with similar structure)
      function findRepeatingPatterns() {
        const patterns = [];

        // Find all potential container elements
        const containers = [
          ...document.querySelectorAll('table tbody'),
          ...document.querySelectorAll('ul'),
          ...document.querySelectorAll('ol'),
          ...document.querySelectorAll('[class*="list"]'),
          ...document.querySelectorAll('[class*="container"]'),
          ...document.querySelectorAll('div')
        ];

        for (const container of containers) {
          const children = Array.from(container.children);

          // Need at least 3 similar children to be a pattern
          if (children.length < 3) continue;

          // Check if children have similar structure
          const firstChild = children[0];
          const firstScore = scoreTransactionLikelihood(firstChild);

          if (firstScore < 20) continue; // Not transaction-like enough

          // Check if siblings have similar scores
          const scores = children.map(c => scoreTransactionLikelihood(c));
          const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
          const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;

          // Low variance = similar structure = likely a pattern
          if (variance < 100 && avgScore > 20) {
            patterns.push({
              container,
              elements: children,
              avgScore,
              variance,
              confidence: Math.min(100, avgScore + (100 - variance))
            });
          }
        }

        // Sort by confidence
        return patterns.sort((a, b) => b.confidence - a.confidence);
      }

      // Extract transaction data from an element
      function extractTransaction(element) {
        const allText = element.innerText || element.textContent || '';

        // Get all leaf elements (no children) with visible text
        const walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_ELEMENT,
          null
        );

        const childElements = [element];
        let node;
        while (node = walker.nextNode()) {
          // Only include visible elements with text
          if (node.innerText && node.children.length === 0) {
            childElements.push(node);
          }
        }

        // Extract structured data
        let date = null;
        let description = null;
        let amount = null;
        let balance = null;
        let category = null;

        // Collect all money values with their context
        const moneyValues = [];

        for (const child of childElements) {
          const text = (child.innerText || child.textContent || '').trim();
          if (!text || text.length === 0) continue;

          // Identify date
          if (!date && isDateValue(text)) {
            date = text;
            continue;
          }

          // Collect all money values with context
          if (isMoneyValue(text)) {
            const className = (child.className || '').toLowerCase();
            const parentClassName = (child.parentElement?.className || '').toLowerCase();
            const allClasses = className + ' ' + parentClassName;

            moneyValues.push({
              value: text,
              isAmount: allClasses.includes('amount') ||
                       allClasses.includes('debit') ||
                       allClasses.includes('credit') ||
                       allClasses.includes('transaction'),
              isBalance: allClasses.includes('balance') ||
                        allClasses.includes('total') ||
                        allClasses.includes('running'),
              element: child
            });
          }

          // Longest text is likely description (excluding money values)
          if (!isMoneyValue(text) && !isDateValue(text)) {
            if (!description || text.length > (description?.length || 0)) {
              if (text.length > 3 && text.length < 200) {
                description = text;
              }
            }
          }
        }

        // Smart amount selection: prefer amount over balance
        if (moneyValues.length > 0) {
          // First, try to find explicitly marked amount
          const amountValue = moneyValues.find(m => m.isAmount);
          if (amountValue) {
            amount = amountValue.value;
          }

          // Then find balance if exists
          const balanceValue = moneyValues.find(m => m.isBalance);
          if (balanceValue) {
            balance = balanceValue.value;
          }

          // If no explicit amount but we have multiple values, use the first non-balance
          if (!amount && moneyValues.length > 0) {
            const nonBalance = moneyValues.find(m => !m.isBalance);
            amount = nonBalance ? nonBalance.value : moneyValues[0].value;
          }

          // If we only have one value, it's likely the amount
          if (!amount && moneyValues.length === 1) {
            amount = moneyValues[0].value;
          }
        }

        return {
          date: date || '',
          description: description || '',
          amount: amount || '',
          balance: balance || '',
          category: category || '',
          rawText: allText.substring(0, 200)
        };
      }

      // ===== MAIN EXTRACTION LOGIC =====

      console.log('[Scraper] 🔍 Analyzing page structure...');

      const patterns = findRepeatingPatterns();
      console.log('[Scraper] 📊 Found', patterns.length, 'potential patterns');

      if (patterns.length === 0) {
        console.log('[Scraper] ❌ No transaction patterns detected');
        return [];
      }

      // Use the highest confidence pattern
      const bestPattern = patterns[0];
      console.log('[Scraper] ✅ Best pattern:', {
        elements: bestPattern.elements.length,
        confidence: bestPattern.confidence.toFixed(1) + '%',
        avgScore: bestPattern.avgScore.toFixed(1),
        containerTag: bestPattern.container.tagName,
        containerClass: bestPattern.container.className
      });

      // Extract transactions from the pattern
      const transactions = bestPattern.elements.map((elem, index) => {
        const txn = extractTransaction(elem);
        return {
          ...txn,
          index: index + 1,
          confidence: scoreTransactionLikelihood(elem)
        };
      });

      // Filter out low-quality extractions
      const validTransactions = transactions.filter(txn => {
        return txn.date && (txn.description || txn.amount);
      });

      console.log('[Scraper] 💰 Extracted', validTransactions.length, 'valid transactions');
      console.log('[Scraper] 📝 Sample:', validTransactions.slice(0, 3));

      return validTransactions;
    })();
  `;
}
