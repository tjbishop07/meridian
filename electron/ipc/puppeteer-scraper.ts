import { ipcMain, BrowserWindow, dialog } from 'electron';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

let activeBrowser: Browser | null = null;
let activePage: Page | null = null;
let isRecording = false;
let recordedSteps: any[] = [];

export function setMainWindow(_window: BrowserWindow) {
  // Reserved for future use
}

// Get Chrome user data directory - use a dedicated automation profile
// This prevents conflicts with the user's main Chrome profile
function getChromeUserDataDir(): string {
  const homeDir = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(homeDir, 'Library/Application Support/PersonalFinance/ChromeProfile');
  } else if (process.platform === 'win32') {
    return path.join(homeDir, 'AppData/Local/PersonalFinance/ChromeProfile');
  } else {
    return path.join(homeDir, '.config/personal-finance/chrome-profile');
  }
}

export function registerPuppeteerScraperHandlers() {
  // Find Chrome executable path
  ipcMain.handle('puppeteer:find-chrome', async () => {
    try {
      // Common Chrome paths on macOS
      const chromePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      ];

      for (const path of chromePaths) {
        try {
          await execAsync(`test -f "${path}"`);
          return { found: true, path };
        } catch {
          continue;
        }
      }

      return { found: false, error: 'Chrome not found' };
    } catch (error) {
      return { found: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Start Puppeteer browser
  ipcMain.handle('puppeteer:start-browser', async (_, options: {
    startUrl: string;
    chromePath?: string;
    useUserProfile?: boolean;
  }) => {
    try {
      console.log('[Puppeteer] Starting browser...');

      // Find Chrome if not provided
      let executablePath = options.chromePath;
      if (!executablePath) {
        // Common Chrome paths on macOS
        const chromePaths = [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        ];

        for (const path of chromePaths) {
          try {
            await execAsync(`test -f "${path}"`);
            executablePath = path;
            break;
          } catch {
            continue;
          }
        }

        if (!executablePath) {
          return { success: false, error: 'Chrome executable not found' };
        }
      }

      // Prepare launch options
      const launchOptions: any = {
        executablePath,
        headless: false,
        defaultViewport: null,
        timeout: 60000, // Increase timeout to 60 seconds for user profile
        protocolTimeout: 60000, // Also increase protocol timeout
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--window-size=1400,900',
          '--disable-infobars',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check',
        ],
      };

      // Use persistent Chrome profile for cookies and sessions
      if (options.useUserProfile) {
        const userDataDir = getChromeUserDataDir();

        // Create profile directory if it doesn't exist
        if (!fs.existsSync(userDataDir)) {
          console.log('[Puppeteer] Creating profile directory:', userDataDir);
          fs.mkdirSync(userDataDir, { recursive: true });
        }

        console.log('[Puppeteer] Using persistent Chrome profile from:', userDataDir);
        launchOptions.userDataDir = userDataDir;

        // When using user profile, increase timeouts even more
        launchOptions.timeout = 90000; // 90 seconds for profile loading
        launchOptions.protocolTimeout = 90000;

        // Additional args for user profile
        launchOptions.args.push(
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-extensions-except', // Load faster
          '--disable-component-extensions-with-background-pages',
          '--disable-session-crashed-bubble', // Prevent restore dialogs
          '--disable-infobars'
        );
      } else {
        // For non-profile mode, disable restore
        launchOptions.args.push('--disable-session-restore');
      }

      console.log('[Puppeteer] Launching browser with timeout:', launchOptions.timeout);

      // Launch browser
      activeBrowser = await puppeteer.launch(launchOptions);

      // Create a fresh new page (don't use restored pages from profile)
      console.log('[Puppeteer] Creating new page...');
      activePage = await activeBrowser.newPage();
      console.log('[Puppeteer] New page created successfully');

      // Close any restored pages from profile to avoid confusion
      const pages = await activeBrowser.pages();
      console.log('[Puppeteer] Found', pages.length, 'total pages, closing restored ones...');
      for (const page of pages) {
        if (page !== activePage) {
          try {
            await page.close();
          } catch (e) {
            // Ignore errors closing restored pages
          }
        }
      }

      // Set realistic user agent (latest Chrome on macOS)
      console.log('[Puppeteer] Setting user agent...');
      const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
      await activePage.setUserAgent(userAgent);

      // Override webdriver detection
      console.log('[Puppeteer] Setting up stealth overrides...');
      await activePage.evaluateOnNewDocument(() => {
        // Remove webdriver flag
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // Override plugins to appear more real
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Override languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });

        // Add Chrome runtime
        (window as any).chrome = {
          runtime: {},
        };

        // Override permissions
        const originalQuery = (window.navigator.permissions as any).query;
        (window.navigator.permissions as any).query = (parameters: any) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      });

      // Navigate to start URL with more lenient wait condition
      console.log('[Puppeteer] Navigating to:', options.startUrl);
      console.log('[Puppeteer] Navigation timeout set to 30 seconds...');

      try {
        const navigationPromise = activePage.goto(options.startUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        await navigationPromise;
        console.log('[Puppeteer] ✓ Navigation complete successfully');
      } catch (navError: any) {
        console.error('[Puppeteer] ✗ Navigation failed:', navError?.message || navError);
        console.log('[Puppeteer] Current page URL:', await activePage.url());
        // Continue anyway - user can manually navigate
      }

      console.log('[Puppeteer] Browser started successfully, returning to renderer...');
      return { success: true };
    } catch (error) {
      console.error('[Puppeteer] Failed to start browser:', error);

      let errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Provide helpful error messages
      if (errorMessage.includes('Timed out') || errorMessage.includes('timeout')) {
        if (options.useUserProfile) {
          errorMessage = 'Browser startup timed out. Try: 1) Close ALL Chrome windows, 2) Wait 10 seconds, 3) Try again. Or uncheck "Use My Chrome Profile" to use a clean browser.';
        } else {
          errorMessage = 'Browser startup timed out. Chrome may be busy. Please try again.';
        }
      } else if (errorMessage.includes('Could not find Chrome')) {
        errorMessage = 'Chrome executable not found. Please install Google Chrome.';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  });

  // Start recording user actions
  ipcMain.handle('puppeteer:start-recording', async () => {
    if (!activePage) {
      return { success: false, error: 'No active browser' };
    }

    try {
      isRecording = true;
      recordedSteps = [];

      // Get current URL
      const currentUrl = activePage.url();
      console.log('[Puppeteer] Started recording from URL:', currentUrl);

      // Record click events
      await activePage.exposeFunction('recordClick', (selector: string, text: string) => {
        if (isRecording) {
          recordedSteps.push({
            type: 'click',
            selector,
            text,
            timestamp: Date.now(),
          });
          console.log('[Puppeteer] Recorded click:', selector);
        }
      });

      // Record input events
      await activePage.exposeFunction('recordInput', (selector: string, value: string, isSensitive: boolean) => {
        if (isRecording) {
          recordedSteps.push({
            type: 'input',
            selector,
            value: isSensitive ? '${SENSITIVE}' : value,
            isSensitive,
            timestamp: Date.now(),
          });
          console.log('[Puppeteer] Recorded input:', selector);
        }
      });

      // Inject recording script
      await activePage.evaluate(() => {
        // Record clicks
        document.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          const selector = generateSelector(target);
          const text = target.innerText?.substring(0, 50) || '';
          (window as any).recordClick(selector, text);
        }, true);

        // Record inputs
        document.addEventListener('input', (e) => {
          const target = e.target as HTMLInputElement;
          const selector = generateSelector(target);
          const isSensitive = target.type === 'password' ||
                              target.autocomplete === 'username' ||
                              target.name?.toLowerCase().includes('password') ||
                              target.name?.toLowerCase().includes('pin');
          (window as any).recordInput(selector, target.value, isSensitive);
        }, true);

        // Helper to generate CSS selector
        function generateSelector(el: HTMLElement): string {
          if (el.id) return `#${el.id}`;
          if (el.className) {
            const classes = el.className.split(' ').filter(c => c.length > 0);
            if (classes.length > 0) return `.${classes.join('.')}`;
          }

          // Fall back to nth-child selector
          const parent = el.parentElement;
          if (!parent) return el.tagName.toLowerCase();

          const children = Array.from(parent.children);
          const index = children.indexOf(el) + 1;
          return `${parent.tagName.toLowerCase()} > ${el.tagName.toLowerCase()}:nth-child(${index})`;
        }
      });

      return { success: true, url: currentUrl };
    } catch (error) {
      console.error('[Puppeteer] Failed to start recording:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Stop recording
  ipcMain.handle('puppeteer:stop-recording', async () => {
    isRecording = false;
    console.log('[Puppeteer] Stopped recording, captured', recordedSteps.length, 'steps');
    return { success: true, steps: recordedSteps };
  });

  // Execute a recipe
  ipcMain.handle('puppeteer:execute-recipe', async (_, recipe: {
    steps: any[];
    extractionScript?: string;
  }) => {
    if (!activePage) {
      return { success: false, error: 'No active browser' };
    }

    try {
      console.log('[Puppeteer] Executing recipe with', recipe.steps.length, 'steps');

      // Execute each step
      for (const step of recipe.steps) {
        console.log('[Puppeteer] Executing step:', step.type, step.selector);

        if (step.type === 'click') {
          await activePage.waitForSelector(step.selector, { timeout: 5000 });
          await activePage.click(step.selector);
          await new Promise(resolve => setTimeout(resolve, 500));
        } else if (step.type === 'input') {
          await activePage.waitForSelector(step.selector, { timeout: 5000 });

          // Handle sensitive data
          let value = step.value;
          if (step.isSensitive && value.includes('${SENSITIVE}')) {
            // Prompt user for sensitive input
            const result = await dialog.showMessageBox({
              type: 'question',
              message: `Enter ${step.selector}`,
              detail: 'This is a sensitive field (password, PIN, etc.)',
              buttons: ['Cancel', 'OK'],
              defaultId: 1,
            });

            if (result.response === 0) {
              return { success: false, error: 'User cancelled' };
            }

            // In production, use a proper secure input dialog
            value = ''; // Placeholder - need to implement secure input
          }

          await activePage.type(step.selector, value, { delay: 50 });
          await new Promise(resolve => setTimeout(resolve, 300));
        } else if (step.type === 'navigate') {
          await activePage.goto(step.url, { waitUntil: 'networkidle2' });
        } else if (step.type === 'wait') {
          await activePage.waitForSelector(step.selector, { timeout: step.timeout || 5000 });
        }
      }

      // Extract transactions using provided script or default
      const extractionScript = recipe.extractionScript || getDefaultExtractionScript();

      const transactions = await activePage.evaluate(extractionScript) as any[];

      console.log('[Puppeteer] Extracted', transactions.length, 'transactions');

      return {
        success: true,
        transactions,
        count: transactions.length,
      };
    } catch (error) {
      console.error('[Puppeteer] Recipe execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Extract transactions from current page
  ipcMain.handle('puppeteer:extract-transactions', async () => {
    if (!activePage) {
      return { success: false, error: 'No active browser' };
    }

    try {
      console.log('[Puppeteer] Extracting transactions from current page...');

      const transactions = await activePage.evaluate(getDefaultExtractionScript()) as any[];

      console.log('[Puppeteer] Extracted', transactions.length, 'transactions');

      return {
        success: true,
        transactions,
        count: transactions.length,
      };
    } catch (error) {
      console.error('[Puppeteer] Extraction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Close browser
  ipcMain.handle('puppeteer:close-browser', async () => {
    try {
      if (activeBrowser) {
        await activeBrowser.close();
        activeBrowser = null;
        activePage = null;
        isRecording = false;
        recordedSteps = [];
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}

// Default transaction extraction script
function getDefaultExtractionScript(): string {
  return `
    () => {
      // Try multiple strategies to find transactions
      const transactions = [];

      // Strategy 1: Look for table rows
      const tableRows = document.querySelectorAll('table tbody tr, table tr');
      for (const row of tableRows) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          // Try to identify date, description, amount
          const rowText = Array.from(cells).map(c => c.innerText.trim());

          // Look for patterns
          let date = null;
          let description = null;
          let amount = null;

          for (const text of rowText) {
            // Check if it's a date
            if (/\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4}/.test(text)) {
              date = text;
            }
            // Check if it's an amount
            else if (/[\\$]?\\d+\\.\\d{2}/.test(text)) {
              amount = text.replace(/[\\$,]/g, '');
            }
            // Otherwise might be description
            else if (text.length > 3 && !date && !amount) {
              description = text;
            }
          }

          if (date && (description || amount)) {
            transactions.push({
              date,
              description: description || 'Unknown',
              amount: amount ? parseFloat(amount) : 0,
            });
          }
        }
      }

      // Strategy 2: Look for common transaction classes
      const txnElements = document.querySelectorAll(
        '[class*="transaction"], [class*="activity"], ' +
        '[data-transaction], [data-activity]'
      );

      for (const el of txnElements) {
        const dateEl = el.querySelector('[class*="date"], [data-date]');
        const descEl = el.querySelector('[class*="description"], [class*="merchant"], [data-description]');
        const amountEl = el.querySelector('[class*="amount"], [data-amount]');

        if (dateEl || descEl || amountEl) {
          transactions.push({
            date: dateEl?.textContent?.trim() || '',
            description: descEl?.textContent?.trim() || 'Unknown',
            amount: parseFloat(amountEl?.textContent?.trim().replace(/[\\$,]/g, '') || '0'),
          });
        }
      }

      return transactions;
    }
  `;
}
