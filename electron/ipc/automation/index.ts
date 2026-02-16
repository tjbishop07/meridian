/**
 * Automation Module - Main Entry Point
 *
 * Handles browser automation for recording and playing back user interactions.
 * Coordinates between recording, playback, scraping, and AI cleanup modules.
 */

import { ipcMain, BrowserWindow } from 'electron';
import type { PlaybackState, RecordingStep, ScrapedTransaction } from './types';
import { executeStep, resetPageTracking } from './playback';
import { scrapeTransactions } from './scraper';
import { cleanTransactionsWithAI, ensureOllamaRunning } from './ai-cleanup';
import { registerRecordingHandlers, setMainWindow as setBrowserViewMainWindow } from '../automation-browserview';
import { getDatabase } from '../../db';

// Window references
let mainWindow: BrowserWindow | null = null;
let playbackWindow: BrowserWindow | null = null;

// Playback state
let playbackState: PlaybackState | null = null;

/**
 * Set the main application window reference
 */
export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window;
  setBrowserViewMainWindow(window);
}

/**
 * Register all automation IPC handlers
 */
export function registerAutomationHandlers(): void {
  // Register recording handlers (from browserview module)
  registerRecordingHandlers();

  // Play a recorded recipe
  ipcMain.handle('automation:play-recording', async (_, recipeId: string) => {
    console.log('[Automation] Playing recording:', recipeId);
    return await playRecording(recipeId);
  });

  // Get current recording state
  ipcMain.handle('automation:get-current-recording', async () => {
    return playbackState;
  });

  console.log('[Automation] IPC handlers registered (recording + playback)');
}

/**
 * Play a recorded automation recipe
 */
async function playRecording(recipeId: string): Promise<{ success: boolean; message?: string }> {
  try {
    console.log('[Automation] Starting playback for recipe:', recipeId);

    // Get recipe from database
    const { getDatabase } = await import('../../db');
    const db = getDatabase();
    const recipe = db
      .prepare('SELECT * FROM export_recipes WHERE id = ?')
      .get(recipeId) as any;

    if (!recipe) {
      throw new Error(`Recipe ${recipeId} not found`);
    }

    const steps = JSON.parse(recipe.steps) as RecordingStep[];
    const startUrl = recipe.url;

    console.log(`[Automation] Recipe has ${steps.length} steps, starting at: ${startUrl}`);

    // Create playback window
    playbackWindow = new BrowserWindow({
      width: 1400,
      height: 1000,
      show: true, // Make sure window is visible
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webSecurity: false, // Disable for automation to access cross-origin iframes
        partition: 'persist:recorder', // SAME session as recorder to share cookies/auth!
      },
    });

    console.log('[Automation] ⚙️ Web security disabled for cross-origin iframe access');
    console.log('[Automation] 🍪 Using same session as recorder (cookies/auth shared)');

    // Diagnostic: Show session info
    const session = playbackWindow.webContents.session;
    const cookies = await session.cookies.get({ domain: 'usaa.com' });
    console.log('[Automation] 🔍 Session partition:', session.isPersistent() ? 'persistent' : 'in-memory');
    console.log('[Automation] 🔍 USAA cookies found:', cookies.length);

    console.log('[Automation] Playback window created, ID:', playbackWindow.id);

    // Set user agent to avoid detection
    const userAgent = playbackWindow.webContents.getUserAgent().replace(/Electron\/[\\S]+\\s/, '');
    playbackWindow.webContents.setUserAgent(userAgent);

    playbackState = {
      recipeId,
      currentStep: 0,
      totalSteps: steps.length,
    };

    // Track navigation state to coordinate between did-finish-load and main loop
    let navigationResolve: (() => void) | null = null;
    let isNavigating = false;

    // Re-inject overlay on every navigation to prevent it from disappearing
    playbackWindow.webContents.on('did-finish-load', async () => {
      if (playbackState && playbackWindow && !playbackWindow.isDestroyed()) {
        console.log('[Automation] 🔄 Page loaded event, waiting for it to fully settle...');

        // Prevent scroll restoration from browser
        await playbackWindow.webContents.executeJavaScript(`
          if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
          }
          window.scrollTo(0, 0);
        `).catch(() => {});

        // Wait longer for complex pages (SPAs, React apps, etc.)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Wait for page to be truly interactive
        await playbackWindow.webContents.executeJavaScript(`
          new Promise((resolve) => {
            if (document.readyState === 'complete') {
              // Wait additional time for React/Vue to hydrate
              setTimeout(resolve, 2000);
            } else {
              window.addEventListener('load', () => {
                setTimeout(resolve, 2000);
              });
            }
          })
        `).catch(() => {
          // If script fails, just continue
          console.log('[Automation] Could not check page ready state');
        });

        // Check if page is still ready (not navigating again)
        if (playbackWindow && !playbackWindow.isDestroyed()) {
          console.log('[Automation] ✓ Page fully settled (waited ~5s), re-injecting overlay...');
          await injectPlaybackOverlay(playbackWindow, playbackState.currentStep, playbackState.totalSteps);

          // Signal to main loop that navigation is complete
          if (isNavigating && navigationResolve) {
            console.log('[Automation] ✓ Signaling main loop that navigation is complete');
            navigationResolve();
            navigationResolve = null;
            isNavigating = false;
          }
        }
      }
    });

    // Load starting URL with comprehensive logging
    console.log('[Automation] ====== URL LOADING DEBUG ======');
    console.log('[Automation] Starting URL:', startUrl);
    console.log('[Automation] URL type:', typeof startUrl);
    console.log('[Automation] URL valid format:', /^https?:\/\/.+/.test(startUrl));
    console.log('[Automation] Window exists:', !!playbackWindow);
    console.log('[Automation] Window destroyed:', playbackWindow.isDestroyed());

    try {
      console.log('[Automation] Calling loadURL...');
      await playbackWindow.loadURL(startUrl);
      console.log('[Automation] ✓ loadURL completed successfully');
      console.log('[Automation] Current URL after load:', playbackWindow.webContents.getURL());
    } catch (error) {
      console.error('[Automation] ✗ Failed to load URL:', error);
      throw new Error(`Failed to load URL: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('[Automation] Waiting 2 seconds for page to settle...');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log('[Automation] Final URL:', playbackWindow.webContents.getURL());
    console.log('[Automation] ====== URL LOADING COMPLETE ======');

    // Inject playback overlay
    await injectPlaybackOverlay(playbackWindow, 0, steps.length);

    // Reset page tracking for clean start
    resetPageTracking();

    // Execute all steps
    let allStepsCompleted = true;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`[Automation] Executing step ${i + 1}/${steps.length}: ${step.type}`);

      // Update playback state (for re-injection after navigation)
      playbackState.currentStep = i + 1;

      // Update progress overlay
      await updatePlaybackProgress(playbackWindow, i + 1, steps.length);

      // Get current URL before executing step
      const urlBefore = playbackWindow.webContents.getURL();

      // Execute the step
      try {
        await executeStep(playbackWindow, step);
      } catch (error) {
        console.error(`[Automation] Step ${i + 1} failed:`, error);

        // Check if navigation occurred despite error
        const urlAfterError = playbackWindow.webContents.getURL();
        if (urlBefore !== urlAfterError) {
          console.log(`[Automation] Navigation detected - treating as success`);
        } else {
          allStepsCompleted = false;
          await showStepError(playbackWindow, i, steps.length, step, error);
          break;
        }
      }

      // Check if navigation occurred
      const urlAfter = playbackWindow.webContents.getURL();
      if (urlBefore !== urlAfter) {
        console.log(`[Automation] Navigation detected: ${urlBefore} -> ${urlAfter}`);
        console.log('[Automation] Waiting for did-finish-load handler to complete...');

        // Set navigation flag and create promise that will be resolved by did-finish-load
        isNavigating = true;
        const navigationComplete = new Promise<void>((resolve) => {
          navigationResolve = resolve;

          // Fallback timeout in case did-finish-load never fires
          setTimeout(() => {
            if (isNavigating) {
              console.log('[Automation] ⚠️ did-finish-load timeout, continuing anyway');
              isNavigating = false;
              resolve();
            }
          }, 15000); // 15 second timeout
        });

        // Wait for did-finish-load handler to finish its work
        await navigationComplete;

        console.log('[Automation] ✓ Navigation complete and page fully settled, continuing automation...');
      }

      // Wait between steps
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Notify completion
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('automation:playback-complete');
    }

    // Only scrape if all steps completed
    if (!allStepsCompleted) {
      console.log('[Automation] Playback incomplete - skipping scrape');
      await updatePlaybackProgress(playbackWindow, steps.length, steps.length, 'Playback incomplete - no import', '#f59e0b');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (playbackWindow && !playbackWindow.isDestroyed()) {
        playbackWindow.close();
      }

      playbackWindow = null;
      playbackState = null;

      return { success: false, message: 'Playback incomplete' };
    }

    // Scrape transactions
    console.log('[Automation] All steps complete! Waiting for transactions to load...');
    await updatePlaybackProgress(playbackWindow, steps.length, steps.length, 'Waiting for transactions...', '#3b82f6');

    // Wait additional time for transaction table to load (many banks use AJAX to load data)
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check if page is still loading data
    let pageInfo = await playbackWindow.webContents.executeJavaScript(`
      ({
        url: window.location.href,
        title: document.title,
        hasTable: document.querySelector('table') !== null,
        rowCount: document.querySelectorAll('table tr').length,
        hasAmountSymbols: (document.body.textContent.match(/\\$\\d+/g) || []).length,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight
      })
    `).catch(() => ({ url: 'unknown', title: 'unknown', hasTable: false, rowCount: 0, hasAmountSymbols: 0, scrollHeight: 0, clientHeight: 0 }));

    console.log('[Automation] Page ready for scraping:', pageInfo);
    console.log(`[Automation]   - URL: ${pageInfo.url}`);
    console.log(`[Automation]   - Title: ${pageInfo.title}`);
    console.log(`[Automation]   - Has table: ${pageInfo.hasTable}`);
    console.log(`[Automation]   - Table rows: ${pageInfo.rowCount}`);
    console.log(`[Automation]   - Amount symbols: ${pageInfo.hasAmountSymbols}`);
    console.log(`[Automation]   - Page height: ${pageInfo.scrollHeight}px (viewport: ${pageInfo.clientHeight}px)`);

    // Thorough scroll through existing content to ensure we capture everything
    console.log('[Automation] Performing thorough scroll to capture all initially loaded transactions...');

    const scrollResult = await playbackWindow.webContents.executeJavaScript(`
      (async function() {
        const initialRowCount = document.querySelectorAll('table tr').length;
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = document.documentElement.clientHeight;

        console.log('[Scroll] Initial state:', initialRowCount, 'rows,', scrollHeight, 'px tall');

        if (scrollHeight > clientHeight * 1.2) {
          // Scroll in smaller increments to ensure nothing is missed
          // Cover the page in ~400px chunks with overlap
          const scrollStep = Math.min(400, clientHeight * 0.6); // ~60% of viewport at a time
          const numSteps = Math.ceil(scrollHeight / scrollStep);

          console.log('[Scroll] Will scroll in', numSteps, 'steps of', scrollStep, 'px');

          let previousRowCount = initialRowCount;

          for (let i = 0; i <= numSteps; i++) {
            const targetY = Math.min(i * scrollStep, scrollHeight - clientHeight);
            window.scrollTo({ top: targetY, behavior: 'instant' });

            // Wait for rendering and any lazy content
            await new Promise(resolve => setTimeout(resolve, 600));

            // Check if we're getting new rows (indicates lazy loading)
            const currentRowCount = document.querySelectorAll('table tr').length;
            if (currentRowCount > previousRowCount) {
              console.log('[Scroll] Row count increased:', previousRowCount, '->', currentRowCount);
              previousRowCount = currentRowCount;
            }

            // If we've reached the end, stop
            if (targetY >= scrollHeight - clientHeight) {
              console.log('[Scroll] Reached bottom of page');
              break;
            }
          }

          // Scroll back to top slowly to ensure all content is rendered
          window.scrollTo({ top: 0, behavior: 'instant' });
          await new Promise(resolve => setTimeout(resolve, 800));
        }

        const finalRowCount = document.querySelectorAll('table tr').length;
        console.log('[Scroll] Final state:', finalRowCount, 'rows');

        return {
          initialRows: initialRowCount,
          finalRows: finalRowCount,
          scrolled: scrollHeight > clientHeight * 1.2
        };
      })()
    `).catch(() => ({ initialRows: 0, finalRows: 0, scrolled: false }));

    console.log(`[Automation] Scroll complete: ${scrollResult.initialRows} -> ${scrollResult.finalRows} rows`);

    // If we're getting way more than 50, it means lazy loading is triggering
    if (scrollResult.finalRows > scrollResult.initialRows * 2) {
      console.warn('[Automation] ⚠️ Row count increased significantly during scroll - lazy loading may have triggered');
      console.warn('[Automation] Will limit to first 50 transactions to avoid historical data');
    }

    pageInfo.rowCount = scrollResult.finalRows;

    await updatePlaybackProgress(playbackWindow, steps.length, steps.length, 'Extracting transactions...', '#3b82f6');

    const { transactions, method } = await scrapeTransactions(playbackWindow);
    console.log(`[Automation] Scraped ${transactions.length} transactions using ${method} method`);

    // AI cleanup disabled - was creating duplicate categories and invalid responses
    // Categories will be assigned manually or through import mapping
    console.log('[Automation] AI cleanup disabled - using raw transaction data');

    // Send transactions to main window
    await updatePlaybackProgress(playbackWindow, steps.length, steps.length, `Found ${transactions.length} transactions! ✓`, '#10b981');

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('automation:scrape-complete', {
        recipeId: String(recipeId),
        transactions,
        count: transactions.length,
      });
    }

    // Update last_run_at timestamp and scraping method
    try {
      const db = getDatabase();
      db.prepare('UPDATE export_recipes SET last_run_at = CURRENT_TIMESTAMP, last_scraping_method = ? WHERE id = ?').run(method, recipeId);
      console.log(`[Automation] Updated last_run_at and scraping method (${method}) for recipe ${recipeId}`);
    } catch (error) {
      console.error('[Automation] Failed to update last_run_at:', error);
    }

    // Close playback window after delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (playbackWindow && !playbackWindow.isDestroyed()) {
      playbackWindow.close();
    }

    playbackWindow = null;
    playbackState = null;

    return { success: true, message: `Imported ${transactions.length} transactions` };
  } catch (error) {
    console.error('[Automation] Playback error:', error);

    if (playbackWindow && !playbackWindow.isDestroyed()) {
      playbackWindow.close();
    }

    playbackWindow = null;
    playbackState = null;

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Inject playback progress overlay into the page
 */
async function injectPlaybackOverlay(window: BrowserWindow, currentStep: number, totalSteps: number): Promise<void> {
  if (!window || window.isDestroyed()) return;

  try {
    await window.webContents.executeJavaScript(`
      (function() {
        // Remove existing overlay
        const existing = document.getElementById('playback-controls');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'playback-controls';
        overlay.innerHTML = \`
          <style>
            @keyframes slideIn {
              from { transform: translateY(-100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }

            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.6; }
            }

            #playback-controls {
              position: fixed;
              top: 16px;
              left: 50%;
              transform: translateX(-50%);
              z-index: 2147483647;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              animation: slideIn 0.3s ease-out;
            }

            #playback-box {
              background: rgba(0, 0, 0, 0.9);
              backdrop-filter: blur(12px);
              border-radius: 12px;
              padding: 16px 24px;
              min-width: 320px;
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
              border: 1px solid rgba(255, 255, 255, 0.1);
            }

            #playback-status {
              font-size: 14px;
              color: #ffffff;
              margin-bottom: 10px;
              font-weight: 500;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            }

            #playback-status::before {
              content: '⚡';
              font-size: 16px;
              animation: pulse 2s infinite;
            }

            #progress-bar {
              width: 100%;
              height: 6px;
              background: rgba(255, 255, 255, 0.2);
              border-radius: 3px;
              overflow: hidden;
            }

            #progress-fill {
              height: 100%;
              background: linear-gradient(90deg, #3b82f6, #60a5fa);
              transition: width 0.3s ease;
              width: ${Math.round((currentStep / totalSteps) * 100)}%;
              box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
            }

            #step-counter {
              font-size: 11px;
              color: rgba(255, 255, 255, 0.7);
              margin-top: 8px;
              text-align: center;
            }
          </style>
          <div id="playback-box">
            <div id="playback-status">Running automation...</div>
            <div id="progress-bar">
              <div id="progress-fill"></div>
            </div>
            <div id="step-counter">Step ${currentStep} of ${totalSteps}</div>
          </div>
        \`;

        document.body.appendChild(overlay);

        window.updatePlaybackProgress = function(current, total, status, color) {
          const statusEl = document.getElementById('playback-status');
          const fillEl = document.getElementById('progress-fill');
          const counterEl = document.getElementById('step-counter');

          if (statusEl && status) statusEl.textContent = status;
          if (statusEl && color) statusEl.style.color = color;
          if (fillEl) {
            fillEl.style.width = Math.round((current / total) * 100) + '%';
            if (color) {
              fillEl.style.background = \`linear-gradient(90deg, \${color}, \${color}dd)\`;
            }
          }
          if (counterEl) counterEl.textContent = \`Step \${current} of \${total}\`;
        };
      })();
    `);
  } catch (error) {
    console.log('[Automation] Could not inject overlay:', error);
  }
}

/**
 * Update playback progress in the overlay
 */
async function updatePlaybackProgress(
  window: BrowserWindow,
  currentStep: number,
  totalSteps: number,
  statusText?: string,
  statusColor?: string
): Promise<void> {
  if (!window || window.isDestroyed()) return;

  const status = statusText || `${currentStep} of ${totalSteps}`;
  const color = statusColor || '#1f2937';

  try {
    await window.webContents.executeJavaScript(`
      if (window.updatePlaybackProgress) {
        window.updatePlaybackProgress(${currentStep}, ${totalSteps}, '${status}', '${color}');
      }
    `);
  } catch (error) {
    console.log('[Automation] Could not update progress');
  }
}

/**
 * Show step error dialog in playback window
 */
async function showStepError(
  window: BrowserWindow,
  stepIndex: number,
  totalSteps: number,
  step: RecordingStep,
  error: any
): Promise<void> {
  if (!window || window.isDestroyed()) return;

  try {
    await window.webContents.executeJavaScript(`
      (function() {
        const dialog = document.createElement('div');
        dialog.innerHTML = \`
          <style>
            #step-error {
              position: fixed;
              top: 0; left: 0; right: 0; bottom: 0;
              background: rgba(0,0,0,0.9);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 2147483649;
            }
            #error-box {
              background: white;
              border-radius: 12px;
              padding: 32px;
              max-width: 600px;
            }
            h2 { margin: 0 0 16px; color: #dc2626; }
            .error-details {
              background: #fef2f2;
              border: 1px solid #fecaca;
              padding: 16px;
              border-radius: 8px;
              margin: 16px 0;
              font-size: 13px;
              color: #991b1b;
            }
          </style>
          <div id="step-error">
            <div id="error-box">
              <h2>⚠️ Step Failed</h2>
              <p>Step ${stepIndex + 1} of ${totalSteps} failed.</p>
              <div class="error-details">
                <strong>Location:</strong> ${step.coordinates ? `Coordinates (${step.coordinates.x}, ${step.coordinates.y})` : 'Unknown'}<br>
                <strong>Action:</strong> ${step.type}<br>
                <strong>Error:</strong> ${(error instanceof Error ? error.message : String(error)).replace(/</g, '&lt;')}
              </div>
            </div>
          </div>
        \`;
        document.body.appendChild(dialog);
      })();
    `);

    await new Promise((resolve) => setTimeout(resolve, 3000));
  } catch (err) {
    console.log('[Automation] Could not show error dialog');
  }
}
