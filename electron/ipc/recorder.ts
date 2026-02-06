import { ipcMain, BrowserWindow, BrowserView, dialog, Notification } from 'electron';
import path from 'path';
import os from 'os';
import { detectFormat } from '../services/csv-detector';

let recorderWindow: BrowserWindow | null = null;
let browserView: BrowserView | null = null;
let isBrowserVisible: boolean = false;

// Content script to inject into the recorder browser
const getRecorderScript = () => `
(function() {
  console.log('[Recorder] Content script loaded');

  // Generate a unique CSS selector for an element
  function generateSelector(element) {
    if (!element) return '';

    // Try ID first
    if (element.id) {
      return '#' + CSS.escape(element.id);
    }

    // Try unique class combination
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\\s+/).filter(c => c);
      if (classes.length > 0) {
        const selector = '.' + classes.map(c => CSS.escape(c)).join('.');
        const matches = document.querySelectorAll(selector);
        if (matches.length === 1) {
          return selector;
        }
      }
    }

    // Try name attribute
    if (element.name) {
      const selector = element.tagName.toLowerCase() + '[name="' + CSS.escape(element.name) + '"]';
      const matches = document.querySelectorAll(selector);
      if (matches.length === 1) {
        return selector;
      }
    }

    // Build path from parent
    let path = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += '#' + CSS.escape(current.id);
        path.unshift(selector);
        break;
      }

      let sibling = current;
      let nth = 1;
      while (sibling.previousElementSibling) {
        sibling = sibling.previousElementSibling;
        if (sibling.tagName === current.tagName) nth++;
      }

      if (nth > 1) {
        selector += ':nth-of-type(' + nth + ')';
      }

      path.unshift(selector);
      current = current.parentElement;

      if (path.length > 5) break; // Limit depth
    }

    return path.join(' > ');
  }

  // Track clicks
  document.addEventListener('click', function(e) {
    const target = e.target;
    const selector = generateSelector(target);

    const interaction = {
      type: 'click',
      selector: selector,
      element: target.tagName,
      text: target.textContent?.substring(0, 50) || '',
      timestamp: Date.now()
    };

    console.log('[Recorder] Click:', interaction);

    // Send to main process
    window.electron?.send?.('recorder:interaction', interaction);
  }, true);

  // Track input changes
  document.addEventListener('input', function(e) {
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      const selector = generateSelector(target);

      const interaction = {
        type: 'input',
        selector: selector,
        element: target.tagName,
        value: target.type === 'password' ? '[REDACTED]' : target.value,
        timestamp: Date.now()
      };

      console.log('[Recorder] Input:', interaction);
      window.electron?.send?.('recorder:interaction', interaction);
    }
  }, true);

  // Track select changes
  document.addEventListener('change', function(e) {
    const target = e.target;
    if (target.tagName === 'SELECT') {
      const selector = generateSelector(target);

      const interaction = {
        type: 'select',
        selector: selector,
        element: target.tagName,
        value: target.value,
        timestamp: Date.now()
      };

      console.log('[Recorder] Select:', interaction);
      window.electron?.send?.('recorder:interaction', interaction);
    }
  }, true);

  console.log('[Recorder] Event listeners registered');
})();
`;

export function registerRecorderHandlers(): void {
  ipcMain.handle('recorder:start', async (_, url: string) => {
    try {
      console.log('[Recorder] Starting recorder for:', url);

      // Close existing recorder window if any
      if (recorderWindow && !recorderWindow.isDestroyed()) {
        recorderWindow.close();
      }

      // Create new recorder window with browser-like settings
      recorderWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'Bank Website - Recording Mode',
        backgroundColor: '#ffffff',
        webPreferences: {
          // Use persistent session to maintain cookies/localStorage
          partition: 'persist:recorder',

          // Enable web features that banks expect
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false, // Some banks need this
          webSecurity: true,
          allowRunningInsecureContent: false,

          // Enable features banks may check for
          plugins: true,
          webgl: true,

          // Allow popups (some banks use them)
          javascript: true,
          images: true,

          // Enable session storage
          enablePreferredSizeMode: false,
        },

        // Make it look like a normal browser window
        autoHideMenuBar: false,

        // Show browser-like controls
        titleBarStyle: 'default',
      });

      // Set realistic user agent (latest Chrome on macOS)
      const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      recorderWindow.webContents.setUserAgent(userAgent);

      // Set additional headers to look more browser-like
      recorderWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = userAgent;
        details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
        details.requestHeaders['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
        details.requestHeaders['DNT'] = '1';
        details.requestHeaders['Upgrade-Insecure-Requests'] = '1';
        callback({ requestHeaders: details.requestHeaders });
      });

      // Enable devtools for debugging (optional - can help users troubleshoot)
      // recorderWindow.webContents.openDevTools();

      // Listen for downloads and auto-import CSV files
      recorderWindow.webContents.session.on('will-download', async (event, item, webContents) => {
        const fileName = item.getFilename();
        const fileExtension = path.extname(fileName).toLowerCase();

        console.log('[Recorder] Download detected:', fileName);

        // Only handle CSV files
        if (fileExtension === '.csv') {
          // Get the default download path
          const savePath = path.join(os.homedir(), 'Downloads', fileName);
          item.setSavePath(savePath);

          // When download completes, trigger auto-import
          item.once('done', async (event, state) => {
            if (state === 'completed') {
              console.log('[Recorder] CSV download completed:', savePath);

              // Notify all windows about the downloaded CSV
              BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed()) {
                  win.webContents.send('csv:downloaded', {
                    filePath: savePath,
                    fileName: fileName,
                  });
                }
              });

              // Show a notification
              if (Notification.isSupported()) {
                const notification = new Notification({
                  title: 'CSV Downloaded',
                  body: `${fileName} is ready to import`,
                });
                notification.show();
              }
            } else if (state === 'interrupted') {
              console.error('[Recorder] Download interrupted:', fileName);
            } else if (state === 'cancelled') {
              console.log('[Recorder] Download cancelled:', fileName);
            }
          });
        }
      });

      // Load the URL with proper options
      await recorderWindow.loadURL(url, {
        userAgent: userAgent,
        extraHeaders: 'pragma: no-cache\n'
      });

      // Inject the recorder script after page loads
      recorderWindow.webContents.on('did-finish-load', () => {
        console.log('[Recorder] Page loaded, injecting script');
        recorderWindow?.webContents.executeJavaScript(getRecorderScript())
          .catch(err => console.error('[Recorder] Failed to inject script:', err));
      });

      // Also inject on frame navigation (for SPAs)
      recorderWindow.webContents.on('did-navigate-in-page', () => {
        console.log('[Recorder] Page navigated, re-injecting script');
        recorderWindow?.webContents.executeJavaScript(getRecorderScript())
          .catch(err => console.error('[Recorder] Failed to inject script:', err));
      });

      // Listen for console messages from the page (for debugging)
      recorderWindow.webContents.on('console-message', (event, level, message) => {
        if (message.includes('[Recorder]')) {
          console.log('[Recorder Page]', message);
        }
      });

      // Capture interactions and send to main window
      recorderWindow.webContents.on('console-message', (event, level, message) => {
        // Try to parse recorder interactions from console
        if (message.startsWith('[Recorder]') && message.includes('{')) {
          try {
            const jsonStart = message.indexOf('{');
            const jsonStr = message.substring(jsonStart);
            const interaction = JSON.parse(jsonStr);

            // Forward to all other windows
            BrowserWindow.getAllWindows().forEach(win => {
              if (win !== recorderWindow && !win.isDestroyed()) {
                win.webContents.send('recorder:interaction', interaction);
              }
            });
          } catch (e) {
            // Not valid JSON, ignore
          }
        }
      });

      // Clean up on close
      recorderWindow.on('closed', () => {
        console.log('[Recorder] Window closed');
        recorderWindow = null;
      });

      return { success: true };
    } catch (error) {
      console.error('[Recorder] Error starting recorder:', error);
      throw error;
    }
  });

  ipcMain.handle('recorder:stop', async () => {
    try {
      console.log('[Recorder] Stopping recorder');

      if (recorderWindow && !recorderWindow.isDestroyed()) {
        recorderWindow.close();
        recorderWindow = null;
      }

      return { success: true };
    } catch (error) {
      console.error('[Recorder] Error stopping recorder:', error);
      throw error;
    }
  });

  // New handlers for embedded browser view
  ipcMain.handle('browser:attach', async (event, url: string) => {
    try {
      const mainWindow = BrowserWindow.fromWebContents(event.sender);
      if (!mainWindow) {
        throw new Error('Main window not found');
      }

      console.log('[Browser] Attaching browser view for:', url);

      // Close existing browser view if any
      if (browserView && !browserView.webContents.isDestroyed()) {
        mainWindow.removeBrowserView(browserView);
        (browserView.webContents as any).destroy();
        browserView = null;
      }

      // Create new browser view with browser-like settings
      browserView = new BrowserView({
        webPreferences: {
          partition: 'persist:browser',
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true, // Use sandbox for better security
          webSecurity: true,
          javascript: true,
        },
      });

      // Set realistic user agent
      const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      browserView.webContents.setUserAgent(userAgent);

      // Set browser-like headers
      browserView.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = userAgent;
        details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
        details.requestHeaders['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
        details.requestHeaders['DNT'] = '1';
        details.requestHeaders['Upgrade-Insecure-Requests'] = '1';
        callback({ requestHeaders: details.requestHeaders });
      });

      // Listen for downloads
      browserView.webContents.session.on('will-download', async (event, item, webContents) => {
        const fileName = item.getFilename();
        const fileExtension = path.extname(fileName).toLowerCase();

        console.log('[Browser] Download detected:', fileName);

        if (fileExtension === '.csv') {
          const savePath = path.join(os.homedir(), 'Downloads', fileName);
          item.setSavePath(savePath);

          item.once('done', async (event, state) => {
            if (state === 'completed') {
              console.log('[Browser] CSV download completed:', savePath);

              // Notify main window
              mainWindow.webContents.send('csv:downloaded', {
                filePath: savePath,
                fileName: fileName,
              });

              // Show notification
              if (Notification.isSupported()) {
                new Notification({
                  title: 'CSV Downloaded',
                  body: `${fileName} is ready to import`,
                }).show();
              }
            }
          });
        }
      });

      // Handle navigation events
      browserView.webContents.on('did-start-loading', () => {
        mainWindow.webContents.send('browser:loading', true);
      });

      browserView.webContents.on('did-stop-loading', () => {
        mainWindow.webContents.send('browser:loading', false);
      });

      browserView.webContents.on('did-navigate', (event, url) => {
        mainWindow.webContents.send('browser:url-changed', url);
      });

      browserView.webContents.on('did-navigate-in-page', (event, url) => {
        mainWindow.webContents.send('browser:url-changed', url);
      });

      // Handle navigation errors
      browserView.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        // Ignore errors for cancelled loads or user navigating away
        if (errorCode === -3 || errorCode === -2) {
          console.log('[Browser] Load cancelled or failed:', validatedURL);
        } else {
          console.error('[Browser] Failed to load:', errorCode, errorDescription, validatedURL);
          mainWindow.webContents.send('browser:error', {
            code: errorCode,
            description: errorDescription,
            url: validatedURL,
          });
        }
        mainWindow.webContents.send('browser:loading', false);
      });

      // Attach to main window
      mainWindow.addBrowserView(browserView);

      // Position the browser view
      // Account for sidebar (256px) and address bar (~110px with padding)
      const SIDEBAR_WIDTH = 256;
      const ADDRESS_BAR_HEIGHT = 110;

      const bounds = mainWindow.getContentBounds();
      browserView.setBounds({
        x: SIDEBAR_WIDTH,
        y: ADDRESS_BAR_HEIGHT,
        width: bounds.width - SIDEBAR_WIDTH,
        height: bounds.height - ADDRESS_BAR_HEIGHT,
      });

      // Store resize handler so we can remove it later
      const resizeHandler = () => {
        if (browserView && !browserView.webContents.isDestroyed()) {
          const newBounds = mainWindow.getContentBounds();

          // Only reposition to visible area if browser should be visible
          if (isBrowserVisible) {
            browserView.setBounds({
              x: SIDEBAR_WIDTH,
              y: ADDRESS_BAR_HEIGHT,
              width: newBounds.width - SIDEBAR_WIDTH,
              height: newBounds.height - ADDRESS_BAR_HEIGHT,
            });
          } else {
            // Keep it hidden off-screen
            browserView.setBounds({
              x: -10000,
              y: -10000,
              width: 1,
              height: 1,
            });
          }
        }
      };

      mainWindow.on('resize', resizeHandler);

      // Store the handler so we can remove it on detach
      (browserView as any)._resizeHandler = resizeHandler;

      // Mark as visible since we just attached it
      isBrowserVisible = true;

      // Load URL (don't await to avoid blocking if initial load fails)
      browserView.webContents.loadURL(url, { userAgent }).catch(err => {
        console.error('[Browser] Initial load failed:', err.message);
        // Don't throw - user can navigate manually via address bar
      });

      return { success: true, url };
    } catch (error) {
      console.error('[Browser] Error attaching browser view:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('browser:hide', async (event) => {
    try {
      const mainWindow = BrowserWindow.fromWebContents(event.sender);
      if (!mainWindow) return { success: false };

      console.log('[Browser] Hiding browser view');

      if (browserView && !browserView.webContents.isDestroyed()) {
        // Move browser view off-screen instead of destroying it
        browserView.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
        isBrowserVisible = false;
      }

      return { success: true };
    } catch (error) {
      console.error('[Browser] Error hiding browser view:', error);
      throw error;
    }
  });

  ipcMain.handle('browser:show', async (event) => {
    try {
      const mainWindow = BrowserWindow.fromWebContents(event.sender);
      if (!mainWindow) {
        console.error('[Browser] Main window not found');
        return { success: false };
      }

      console.log('[Browser] Showing browser view, exists:', !!browserView, 'destroyed:', browserView?.webContents.isDestroyed());

      if (browserView && !browserView.webContents.isDestroyed()) {
        // Make sure browser view is added to window (in case it was removed)
        const browserViews = mainWindow.getBrowserViews();
        if (!browserViews.includes(browserView)) {
          console.log('[Browser] Re-adding browser view to window');
          mainWindow.addBrowserView(browserView);
        }

        // Restore browser view to correct position
        const SIDEBAR_WIDTH = 256;
        const ADDRESS_BAR_HEIGHT = 110;
        const bounds = mainWindow.getContentBounds();

        browserView.setBounds({
          x: SIDEBAR_WIDTH,
          y: ADDRESS_BAR_HEIGHT,
          width: bounds.width - SIDEBAR_WIDTH,
          height: bounds.height - ADDRESS_BAR_HEIGHT,
        });

        isBrowserVisible = true;

        console.log('[Browser] Browser view shown successfully');
        return { success: true };
      } else {
        // Browser view doesn't exist yet
        console.log('[Browser] Browser view does not exist');
        return { success: false };
      }
    } catch (error) {
      console.error('[Browser] Error showing browser view:', error);
      return { success: false };
    }
  });

  ipcMain.handle('browser:detach', async (event) => {
    try {
      const mainWindow = BrowserWindow.fromWebContents(event.sender);
      if (!mainWindow) return { success: false };

      console.log('[Browser] Detaching browser view');

      if (browserView && !browserView.webContents.isDestroyed()) {
        // Remove resize handler
        const resizeHandler = (browserView as any)._resizeHandler;
        if (resizeHandler) {
          mainWindow.removeListener('resize', resizeHandler);
          delete (browserView as any)._resizeHandler;
        }

        // Remove and destroy browser view
        mainWindow.removeBrowserView(browserView);
        (browserView.webContents as any).destroy();
        browserView = null;
        isBrowserVisible = false;
      }

      return { success: true };
    } catch (error) {
      console.error('[Browser] Error detaching browser view:', error);
      throw error;
    }
  });

  ipcMain.handle('browser:navigate', async (_, url: string) => {
    try {
      if (!browserView || browserView.webContents.isDestroyed()) {
        console.error('[Browser] Browser view not available for navigation');
        return { success: false, error: 'Browser view not attached' };
      }

      console.log('[Browser] Navigating to:', url);

      // Load URL without awaiting to avoid blocking
      browserView.webContents.loadURL(url).catch(err => {
        console.error('[Browser] Navigation failed:', err.message);
      });

      return { success: true };
    } catch (error) {
      console.error('[Browser] Error navigating:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('browser:back', async () => {
    try {
      if (browserView && !browserView.webContents.isDestroyed()) {
        if (browserView.webContents.canGoBack()) {
          browserView.webContents.goBack();
          return { success: true };
        }
      }
      return { success: false };
    } catch (error) {
      console.error('[Browser] Error going back:', error);
      return { success: false };
    }
  });

  ipcMain.handle('browser:forward', async () => {
    try {
      if (browserView && !browserView.webContents.isDestroyed()) {
        if (browserView.webContents.canGoForward()) {
          browserView.webContents.goForward();
          return { success: true };
        }
      }
      return { success: false };
    } catch (error) {
      console.error('[Browser] Error going forward:', error);
      return { success: false };
    }
  });

  ipcMain.handle('browser:reload', async () => {
    try {
      if (browserView && !browserView.webContents.isDestroyed()) {
        browserView.webContents.reload();
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      console.error('[Browser] Error reloading:', error);
      return { success: false };
    }
  });

  console.log('Recorder IPC handlers registered');
}
