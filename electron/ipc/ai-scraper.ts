import { ipcMain, BrowserWindow, app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

let scraperWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let currentAccountId: number | null = null;

// Helper function to repair incomplete JSON
function repairIncompleteJSON(jsonStr: string): string {
  let repaired = jsonStr.trim();

  // If the JSON is incomplete (doesn't end with ]), try to close it
  if (!repaired.endsWith(']')) {
    // Remove any trailing incomplete object
    const lastCompleteObject = repaired.lastIndexOf('}');
    if (lastCompleteObject !== -1) {
      repaired = repaired.substring(0, lastCompleteObject + 1);
      // Add closing bracket
      repaired += '\n]';
      console.log('[AI Scraper] Repaired incomplete JSON by closing array');
    }
  }

  // Remove trailing commas before closing braces/brackets
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

  return repaired;
}

// Helper function to extract only complete transaction objects
function extractCompleteTransactions(jsonStr: string): any[] {
  const transactions: any[] = [];

  // Find all complete transaction objects using regex (with optional category)
  // Match patterns with and without category field
  const transactionRegex = /\{\s*"date"\s*:\s*"[^"]+"\s*,\s*"description"\s*:\s*"[^"]*"\s*,\s*"amount"\s*:\s*-?\d+\.?\d*(?:\s*,\s*"category"\s*:\s*(?:"[^"]*"|null))?\s*\}/g;
  const matches = jsonStr.matchAll(transactionRegex);

  for (const match of matches) {
    try {
      const txn = JSON.parse(match[0]);
      transactions.push(txn);
    } catch (e) {
      // Skip invalid transactions
      console.warn('[AI Scraper] Skipping malformed transaction:', match[0]);
    }
  }

  return transactions;
}

export function setMainWindow(window: BrowserWindow) {
  mainWindow = window;
}

export function registerAIScraperHandlers() {
  // Check if required model is installed
  ipcMain.handle('ai-scraper:check-model', async () => {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (!response.ok) {
        return { installed: false, error: 'Ollama server not running' };
      }

      const data = await response.json();
      const models = data.models?.map((m: any) => m.name) || [];

      // Check for llama3.2 (text model for HTML scraping)
      // Use precise matching: model name without tag should equal 'llama3.2'
      const hasTextModel = models.some((m: string) => {
        const baseName = m.split(':')[0];
        return baseName === 'llama3.2';
      });

      return {
        installed: hasTextModel,
        availableModels: models,
      };
    } catch (error) {
      return { installed: false, error: 'Could not check models' };
    }
  });

  // Open browser for AI scraping
  ipcMain.handle('ai-scraper:open-browser', async (_, options: { accountId: number; startUrl?: string }) => {
    try {
      currentAccountId = options.accountId;

      // Close existing window if any
      if (scraperWindow && !scraperWindow.isDestroyed()) {
        scraperWindow.close();
      }

      // Get preload path
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      let preloadPath = path.join(__dirname, '..', 'ai-scraper-preload.cjs');

      // Check if file exists, try alternate path if not
      const fs = await import('fs');
      if (!fs.existsSync(preloadPath)) {
        console.warn('[AI Scraper] Preload not found at:', preloadPath);
        preloadPath = path.join(app.getAppPath(), 'dist-electron', 'ai-scraper-preload.cjs');
        console.log('[AI Scraper] Trying alternate path:', preloadPath);

        if (!fs.existsSync(preloadPath)) {
          console.error('[AI Scraper] Preload file not found at either location!');
          throw new Error('AI Scraper preload file not found');
        }
      }

      console.log('[AI Scraper] Using preload path:', preloadPath);

      // Create browser window with preload
      scraperWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'AI Transaction Scraper - Navigate to Transactions Page',
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

      // Load start URL
      const startUrl = options.startUrl || 'about:blank';
      await scraperWindow.loadURL(startUrl);

      // Inject AI scraper button on every page load
      scraperWindow.webContents.on('did-finish-load', async () => {
        await injectAIScraperButton(scraperWindow!);
      });

      scraperWindow.webContents.on('did-navigate', async () => {
        await injectAIScraperButton(scraperWindow!);
      });

      scraperWindow.webContents.on('did-navigate-in-page', async () => {
        await injectAIScraperButton(scraperWindow!);
      });

      // Clean up on close
      scraperWindow.on('closed', () => {
        scraperWindow = null;
        currentAccountId = null;
      });

      return { success: true };
    } catch (error) {
      console.error('[AI Scraper] Failed to open browser:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Handle scrape trigger from browser window (vision-based, legacy)
  ipcMain.on('ai-scraper:trigger', async () => {
    await executeAIScrape();
  });

  // Handle HTML scrape trigger from browser window (preferred method)
  ipcMain.on('ai-scraper:trigger-html', async () => {
    await executeHTMLScrape();
  });

  // Execute AI scrape on current page
  ipcMain.handle('ai-scraper:execute', async () => {
    return await executeAIScrape();
  });

  // Execute HTML-based scrape (more accurate, no vision needed)
  ipcMain.handle('ai-scraper:execute-html', async () => {
    return await executeHTMLScrape();
  });
}

async function executeHTMLScrape() {
  if (!scraperWindow || scraperWindow.isDestroyed()) {
    return { success: false, error: 'No scraper window open' };
  }

  if (!currentAccountId) {
    return { success: false, error: 'No account selected' };
  }

  try {
    console.log('[AI Scraper HTML] Extracting page HTML...');

    // Get the page HTML
    const html = await scraperWindow.webContents.executeJavaScript('document.documentElement.outerHTML');
    const url = scraperWindow.webContents.getURL();

    console.log('[AI Scraper HTML] HTML length:', html.length);
    console.log('[AI Scraper HTML] Calling Ollama...');

    const prompt = `You are a transaction extraction tool. Analyze this HTML from a bank website and extract ALL transactions.

HTML Source (truncated to first 40000 chars):
${html.substring(0, 40000)}

Your response must be ONLY a JSON array. No explanations.

Format:
[
  {
    "date": "2024-01-15",
    "description": "Amazon Purchase",
    "amount": -45.99,
    "category": "Shopping"
  }
]

Rules:
- Negative amounts for expenses, positive for income
- YYYY-MM-DD date format
- Include category if found in HTML
- Extract ALL transactions in the HTML
- Return empty array [] if none found
- Only JSON array, no markdown or text

Extract ALL transactions:`;

    // Call Ollama with text model
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',  // Text model (3B, fast)
        prompt: prompt,
        stream: false,
        options: {
          num_predict: 8000,
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Scraper HTML] Ollama error:', response.status, errorText);
      return {
        success: false,
        error: `Ollama error: ${response.status}`,
      };
    }

    const data = await response.json();
    console.log('[AI Scraper HTML] Processing response...');

    // Parse JSON (using same logic as vision scraper)
    let transactionsText = data.response;
    let cleaned = transactionsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const jsonMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const repaired = repairIncompleteJSON(cleaned);
    let transactions: any[] = [];

    try {
      transactions = JSON.parse(repaired);
      console.log('[AI Scraper HTML] Successfully parsed', transactions.length, 'transactions');
    } catch (parseError) {
      console.error('[AI Scraper HTML] Parse failed, trying extraction...');
      transactions = extractCompleteTransactions(cleaned);
      if (transactions.length === 0) {
        return { success: false, error: 'Could not parse response as JSON' };
      }
      console.log('[AI Scraper HTML] Extracted', transactions.length, 'transactions from partial JSON');
    }

    if (!Array.isArray(transactions)) {
      return { success: false, error: 'Response is not a valid JSON array' };
    }

    if (transactions.length === 0) {
      return { success: false, error: 'No transactions found in HTML' };
    }

    // Send to main window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scraper:transactions-found', {
        accountId: currentAccountId,
        transactions,
      });
    }

    scraperWindow.close();

    return { success: true, count: transactions.length };
  } catch (error) {
    console.error('[AI Scraper HTML] Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function executeAIScrape() {
    if (!scraperWindow || scraperWindow.isDestroyed()) {
      return { success: false, error: 'No scraper window open' };
    }

    if (!currentAccountId) {
      return { success: false, error: 'No account selected' };
    }

    try {
      console.log('[AI Scraper] Capturing screenshot...');

      // Capture full page screenshot
      const image = await scraperWindow.webContents.capturePage();
      const base64 = image.toPNG().toString('base64');

      console.log('[AI Scraper] Screenshot captured, calling Ollama...');

      const prompt = `You are a JSON extraction tool. Analyze this bank transaction page screenshot and extract ALL visible transactions from the entire screenshot.

CRITICAL INSTRUCTIONS:
1. Extract EVERY SINGLE transaction you can see in the image - do not stop early
2. Your response must be ONLY a JSON array with no explanatory text
3. Look carefully at the ENTIRE image from top to bottom

Output format (must be valid JSON array):
[
  {
    "date": "2024-01-15",
    "description": "Amazon Purchase",
    "amount": -45.99,
    "category": "Shopping"
  },
  {
    "date": "2024-01-14",
    "description": "Gas Station",
    "amount": -52.10,
    "category": "Gas & Fuel"
  }
]

Extraction Rules:
- Use negative amounts for expenses/debits, positive for income/credits
- Parse dates to YYYY-MM-DD format (if year is missing, use 2024)
- Use the exact visible description text from each transaction
- If a category/type is visible for the transaction, include it in the "category" field
- If no category is visible, you can omit the "category" field or set it to null
- Only include the transaction amount, NOT the running balance column
- Extract ALL transactions visible in the screenshot, not just the first few
- Return an empty array [] only if genuinely no transactions are visible
- Do NOT include markdown, explanations, or any text except the JSON array
- Start response with [ and end with ]

Begin extracting ALL transactions now:`;

      // Call Ollama API
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2-vision',
          prompt: prompt,
          images: [base64],
          stream: false,
          options: {
            // Increase token limit to handle many transactions
            num_predict: 8000,
            // Keep temperature low for consistent formatting
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AI Scraper] Ollama API error:', response.status, errorText);
        return {
          success: false,
          error: `Ollama API error: ${response.status} - ${errorText}`,
        };
      }

      const data = await response.json();
      console.log('[AI Scraper] Ollama response:', data);

      // Extract JSON from response
      let transactionsText = data.response;
      console.log('[AI Scraper] Raw response text:', transactionsText);

      // Try multiple strategies to extract JSON
      let transactions: any[] = [];
      let parseSuccess = false;

      // Strategy 1: Remove markdown code blocks
      let cleaned = transactionsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      // Strategy 2: Extract JSON array using regex (find first [ to last ])
      const jsonMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }

      // Strategy 3: Try to repair incomplete JSON
      const repaired = repairIncompleteJSON(cleaned);

      // Strategy 4: Try to parse
      try {
        transactions = JSON.parse(repaired);
        parseSuccess = true;
        console.log('[AI Scraper] Successfully parsed JSON');
      } catch (parseError) {
        console.error('[AI Scraper] Failed to parse cleaned response');
        console.error('[AI Scraper] Parse error:', parseError);
        console.error('[AI Scraper] Attempted to parse:', repaired.substring(0, 500) + '...');

        // Last attempt: Extract complete transactions only
        const completeTransactions = extractCompleteTransactions(cleaned);
        if (completeTransactions.length > 0) {
          transactions = completeTransactions;
          parseSuccess = true;
          console.log('[AI Scraper] Extracted', completeTransactions.length, 'complete transactions from partial JSON');
        } else {
          console.error('[AI Scraper] All parsing strategies failed');
        }
      }

      if (!parseSuccess) {
        // Show the actual response to help debug
        const preview = transactionsText.substring(0, 200);
        return {
          success: false,
          error: `Could not parse response as JSON. Model returned: "${preview}..."`,
        };
      }

      console.log('[AI Scraper] Extracted', transactions.length, 'transactions');

      if (!Array.isArray(transactions)) {
        return { success: false, error: 'Response is not a valid JSON array' };
      }

      if (transactions.length === 0) {
        return { success: false, error: 'No transactions found on this page' };
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

      return { success: true, count: transactions.length };
    } catch (error) {
      console.error('[AI Scraper] Scrape failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
}

// Inject floating "AI Scrape This Page" button
async function injectAIScraperButton(window: BrowserWindow) {
  if (!window || window.isDestroyed()) return;

  const controlsCode = `
    (function() {
      // Don't inject on about:blank
      if (window.location.href === 'about:blank') return;

      // Check if already injected
      if (document.getElementById('ai-scraper-controls')) return;

      const controls = document.createElement('div');
      controls.id = 'ai-scraper-controls';
      controls.innerHTML = \`
        <style>
          #ai-scraper-controls {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }

          #ai-scraper-controls button {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            border: none;
            padding: 16px 24px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          #ai-scraper-controls button:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 35px rgba(99, 102, 241, 0.5);
          }

          #ai-scraper-controls button:active {
            transform: translateY(0px);
          }

          #ai-scraper-controls button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .ai-scraper-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
        <button id="ai-scrape-button">
          🤖 AI Scrape This Page
        </button>
      \`;

      document.body.appendChild(controls);

      // Handle button click - now uses HTML scraping (faster, more accurate)
      document.getElementById('ai-scrape-button').addEventListener('click', async () => {
        const button = document.getElementById('ai-scrape-button');
        button.disabled = true;
        button.innerHTML = '<span class="ai-scraper-spinner"></span> Analyzing HTML...';

        // Call the HTML scraper API (uses text model, not vision)
        if (window.aiScraper && window.aiScraper.executeScrapeHTML) {
          window.aiScraper.executeScrapeHTML();
        } else if (window.aiScraper && window.aiScraper.executeScrape) {
          // Fallback to vision scraping if HTML not available
          window.aiScraper.executeScrape();
        } else {
          alert('AI Scraper API not available. Please restart the browser window.');
          button.disabled = false;
          button.innerHTML = '🤖 AI Scrape This Page';
        }

        // Re-enable button after 20 seconds (in case of error)
        setTimeout(() => {
          button.disabled = false;
          button.innerHTML = '🤖 AI Scrape This Page';
        }, 20000);
      });
    })();
  `;

  try {
    await window.webContents.executeJavaScript(controlsCode);
  } catch (error) {
    console.error('[AI Scraper] Failed to inject controls:', error);
  }
}
