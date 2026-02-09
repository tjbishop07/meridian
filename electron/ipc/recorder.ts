import { ipcMain, BrowserWindow, BrowserView, dialog, Notification } from 'electron';
import path from 'path';
import os from 'os';
import { detectFormat } from '../services/csv-detector';

let recorderWindow: BrowserWindow | null = null;
let browserView: BrowserView | null = null;
let isBrowserVisible: boolean = false;

// Current recording state
let currentRecording: {
  url: string;
  interactions: any[];
} | null = null;

// Content script to inject into the recorder browser
const getRecorderScript = () => `
(function() {
  // Prevent duplicate injection using a less obvious flag
  if (window._evtLog) {
    console.log('[Recorder] Script already active, skipping re-injection');
    return;
  }
  console.log('[Recorder] Initializing recorder script on:', window.location.href);
  window._evtLog = true;

  const listeners = [];
  let lastInteraction = null;

  // Generate a unique CSS selector for an element
  function generateSelector(element) {
    if (!element) return '';

    // Strategy 1: Find by associated label text (most stable for forms)
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
      // Try aria-labelledby
      if (element.getAttribute('aria-labelledby')) {
        const labelId = element.getAttribute('aria-labelledby');
        const labelElement = document.getElementById(labelId);
        if (labelElement && labelElement.textContent) {
          return 'label:' + labelElement.textContent.trim();
        }
      }

      // Try label for attribute
      if (element.id) {
        const label = document.querySelector('label[for="' + CSS.escape(element.id) + '"]');
        if (label && label.textContent) {
          return 'label:' + label.textContent.trim();
        }
      }

      // Try parent label
      const parentLabel = element.closest('label');
      if (parentLabel && parentLabel.textContent) {
        return 'label:' + parentLabel.textContent.trim();
      }

      // Try placeholder as label
      if (element.placeholder) {
        return 'placeholder:' + element.placeholder.trim();
      }

      // Try aria-label
      if (element.getAttribute('aria-label')) {
        return 'aria-label:' + element.getAttribute('aria-label').trim();
      }
    }

    // Strategy 2: Try stable attributes
    if (element.name) {
      const selector = element.tagName.toLowerCase() + '[name="' + CSS.escape(element.name) + '"]';
      const matches = document.querySelectorAll(selector);
      if (matches.length === 1) {
        return selector;
      }
    }

    if (element.placeholder) {
      const selector = element.tagName.toLowerCase() + '[placeholder="' + CSS.escape(element.placeholder) + '"]';
      const matches = document.querySelectorAll(selector);
      if (matches.length === 1) {
        return selector;
      }
    }

    if (element.getAttribute('aria-label')) {
      const selector = element.tagName.toLowerCase() + '[aria-label="' + CSS.escape(element.getAttribute('aria-label')) + '"]';
      const matches = document.querySelectorAll(selector);
      if (matches.length === 1) {
        return selector;
      }
    }

    // Try type attribute for inputs
    if (element.type && element.tagName === 'INPUT') {
      const selector = 'input[type="' + CSS.escape(element.type) + '"]';
      const matches = document.querySelectorAll(selector);
      if (matches.length === 1) {
        return selector;
      }
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
  const clickHandler = function(e) {
    const target = e.target;

    // Ignore clicks on recording/playback control elements
    if (target.closest('#recording-controls') ||
        target.closest('#playback-controls') ||
        target.id === 'stop-btn' ||
        target.id === 'start-btn' ||
        target.id === 'pause-btn' ||
        target.id === 'skip-btn' ||
        target.id === 'continue-btn' ||
        target.classList?.contains('control-btn')) {
      console.log('[Recorder] Ignored click on control element:', target.id || target.className);
      return;
    }

    const selector = generateSelector(target);

    const interaction = {
      type: 'click',
      selector: selector,
      element: target.tagName,
      text: target.textContent?.substring(0, 50) || '',
      timestamp: Date.now()
    };

    // Send interaction data via console (looks like debug info)
    console.log('[Recorder] Captured click:', interaction.selector);
    console.log('debug:evt:' + JSON.stringify(interaction));

    // Send to main process
    window.electron?.send?.('recorder:interaction', interaction);
  };
  document.addEventListener('click', clickHandler, false);
  listeners.push({ type: 'click', handler: clickHandler });

  // Track input changes
  const inputHandler = function(e) {
    const target = e.target;

    // Ignore inputs on recording/playback control elements
    if (target.closest('#recording-controls') ||
        target.closest('#playback-controls')) {
      return;
    }

    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      const selector = generateSelector(target);

      const interaction = {
        type: 'input',
        selector: selector,
        element: target.tagName,
        value: target.type === 'password' ? '[REDACTED]' : target.value,
        timestamp: Date.now()
      };

      // Skip if this is a duplicate of the last interaction (same selector and type within 1 second)
      if (lastInteraction &&
          lastInteraction.type === 'input' &&
          lastInteraction.selector === selector &&
          (interaction.timestamp - lastInteraction.timestamp) < 1000) {
        return; // Skip duplicate
      }

      lastInteraction = interaction;
      console.log('[Recorder] Captured interaction:', interaction.type, 'on', interaction.selector);
      console.log('debug:evt:' + JSON.stringify(interaction));
      window.electron?.send?.('recorder:interaction', interaction);
    }
  };
  document.addEventListener('input', inputHandler, false);
  listeners.push({ type: 'input', handler: inputHandler });

  // Track select changes
  const changeHandler = function(e) {
    const target = e.target;

    // Ignore selects in recording/playback control elements
    if (target.closest('#recording-controls') ||
        target.closest('#playback-controls')) {
      return;
    }

    if (target.tagName === 'SELECT') {
      const selector = generateSelector(target);

      const interaction = {
        type: 'select',
        selector: selector,
        element: target.tagName,
        value: target.value,
        timestamp: Date.now()
      };

      console.log('[Recorder] Captured select change:', interaction.selector, '=', interaction.value);
      console.log('debug:evt:' + JSON.stringify(interaction));
      window.electron?.send?.('recorder:interaction', interaction);
    }
  };
  document.addEventListener('change', changeHandler, false);
  listeners.push({ type: 'change', handler: changeHandler });

  // Cleanup function
  window[Symbol.for('__rec_cleanup__')] = function() {
    try {
      listeners.forEach(({ type, handler }) => {
        document.removeEventListener(type, handler, false);
      });
      delete window._evtLog;
      delete window[Symbol.for('__rec_cleanup__')];
    } catch (err) {}
  };
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
      recorderWindow.webContents.on('did-finish-load', async () => {
        console.log('[Recorder] Page loaded, waiting for DOM ready...');
        // Wait a bit for the page to be fully interactive
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('[Recorder] Injecting recorder script');
        recorderWindow?.webContents.executeJavaScript(getRecorderScript())
          .catch(err => console.error('[Recorder] Failed to inject script:', err));
      });

      // Handle full page navigation
      recorderWindow.webContents.on('did-navigate', async (event, url) => {
        console.log('[Recorder] Full navigation detected:', url);
        // Wait for page to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('[Recorder] Re-injecting recorder script after navigation');
        recorderWindow?.webContents.executeJavaScript(getRecorderScript())
          .catch(err => console.error('[Recorder] Failed to inject script:', err));
      });

      // Also inject on frame navigation (for SPAs)
      recorderWindow.webContents.on('did-navigate-in-page', async () => {
        console.log('[Recorder] SPA navigation detected, re-injecting script');
        await new Promise(resolve => setTimeout(resolve, 300));
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
      // Account for sidebar (256px) and address bar (~85px with padding)
      const SIDEBAR_WIDTH = 256;
      const ADDRESS_BAR_HEIGHT = 115; // Account for address bar + saved recipes row

      const bounds = mainWindow.getContentBounds();
      // Account for DevTools if open (docked to right takes ~600px)
      const devToolsWidth = mainWindow.webContents.isDevToolsOpened() ? 600 : 0;

      browserView.setBounds({
        x: SIDEBAR_WIDTH,
        y: ADDRESS_BAR_HEIGHT,
        width: bounds.width - SIDEBAR_WIDTH - devToolsWidth,
        height: bounds.height - ADDRESS_BAR_HEIGHT,
      });

      // Store resize handler so we can remove it later
      const resizeHandler = () => {
        if (browserView && !browserView.webContents.isDestroyed()) {
          const newBounds = mainWindow.getContentBounds();
          const devToolsWidth = mainWindow.webContents.isDevToolsOpened() ? 600 : 0;

          // Only reposition to visible area if browser should be visible
          if (isBrowserVisible) {
            browserView.setBounds({
              x: SIDEBAR_WIDTH,
              y: ADDRESS_BAR_HEIGHT,
              width: newBounds.width - SIDEBAR_WIDTH - devToolsWidth,
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
        const ADDRESS_BAR_HEIGHT = 115; // Account for address bar + saved recipes row
        const bounds = mainWindow.getContentBounds();
        const devToolsWidth = mainWindow.webContents.isDevToolsOpened() ? 600 : 0;

        browserView.setBounds({
          x: SIDEBAR_WIDTH,
          y: ADDRESS_BAR_HEIGHT,
          width: bounds.width - SIDEBAR_WIDTH - devToolsWidth,
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

  ipcMain.handle('browser:start-recording', async () => {
    try {
      if (!browserView || browserView.webContents.isDestroyed()) {
        return { success: false, error: 'Browser view not available' };
      }

      console.log('[Browser] Starting recording in browser view');

      // Initialize recording state
      const currentUrl = browserView.webContents.getURL();
      currentRecording = {
        url: currentUrl,
        interactions: [],
      };

      // Listen for interactions via console messages
      const consoleListener = (event: any, level: number, message: string) => {
        if (message.startsWith('debug:evt:') && message.includes('{')) {
          try {
            const jsonStart = message.indexOf('{');
            const jsonStr = message.substring(jsonStart);
            const interaction = JSON.parse(jsonStr);

            if (currentRecording) {
              // Filter out app UI interactions
              const isAppUI =
                interaction.selector?.includes('e.g., Download') ||
                interaction.selector?.includes('recording-name-input') ||
                interaction.selector?.includes('recipe-name') ||
                interaction.selector?.includes('modal') ||
                interaction.selector?.includes('Stop Recording') ||
                interaction.selector?.includes('Save Recording') ||
                interaction.selector?.includes('stop-recording') ||
                interaction.selector?.includes('save-recording') ||
                interaction.text?.includes('Stop Recording') ||
                interaction.text?.includes('Save Recording') ||
                interaction.text?.includes('Save') && interaction.text?.includes('Cancel');

              if (isAppUI) {
                console.log('[Browser] Filtered out app UI interaction:', interaction.selector || interaction.text);
              } else {
                currentRecording.interactions.push(interaction);
                console.log('[Browser] Captured interaction:', interaction.type);
              }
            }
          } catch (e) {
            // Not valid JSON, ignore
          }
        }
      };

      // Store listener reference for cleanup
      (browserView as any)._recorderListener = consoleListener;
      browserView.webContents.on('console-message', consoleListener);

      // Inject the recorder script into the browser view
      await browserView.webContents.executeJavaScript(getRecorderScript());

      // Re-inject script on page loads to maintain recording across navigations
      const didFinishLoadListener = () => {
        if (currentRecording && browserView && !browserView.webContents.isDestroyed()) {
          console.log('[Browser] Page loaded during recording, re-injecting script');
          browserView.webContents.executeJavaScript(getRecorderScript())
            .catch(err => console.error('[Browser] Failed to re-inject script:', err));
        }
      };

      const didNavigateListener = () => {
        if (currentRecording && browserView && !browserView.webContents.isDestroyed()) {
          console.log('[Browser] Page navigated during recording, re-injecting script');
          browserView.webContents.executeJavaScript(getRecorderScript())
            .catch(err => console.error('[Browser] Failed to re-inject script:', err));
        }
      };

      // Store navigation listeners for cleanup
      (browserView as any)._recorderDidFinishLoadListener = didFinishLoadListener;
      (browserView as any)._recorderDidNavigateListener = didNavigateListener;

      browserView.webContents.on('did-finish-load', didFinishLoadListener);
      browserView.webContents.on('did-navigate-in-page', didNavigateListener);

      return { success: true };
    } catch (error) {
      console.error('[Browser] Error starting recording:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('browser:execute-step', async (_, step: any) => {
    try {
      if (!browserView || browserView.webContents.isDestroyed()) {
        return { success: false, error: 'Browser view not available' };
      }

      console.log('[Browser] Executing step:', step.type, step.selector);

      // Inject script to execute the step with retry logic
      const result = await browserView.webContents.executeJavaScript(`
        (async function() {
          const step = ${JSON.stringify(step)};

          // Helper function to wait
          const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

          // Helper function to find element with retry
          const findElement = async (retries = 3) => {
            for (let i = 0; i < retries; i++) {
              let element;
              try {
                const selector = step.selector;

                // Handle label-based selectors
                if (selector.startsWith('label:')) {
                  const labelText = selector.substring(6);
                  const labels = Array.from(document.querySelectorAll('label'));
                  const label = labels.find(l => l.textContent.trim() === labelText);
                  if (label) {
                    const forAttr = label.getAttribute('for');
                    if (forAttr) {
                      element = document.getElementById(forAttr);
                    } else {
                      element = label.querySelector('input, textarea, select');
                    }
                  }
                }
                // Handle text-based selectors (format: text:ClassName:Text Content)
                else if (selector.startsWith('text:')) {
                  const parts = selector.substring(5).split(':', 2);
                  const className = parts[0];
                  const textContent = parts[1] || parts[0];

                  const cssSelector = className.startsWith('.') ? className : '.' + className;
                  const elements = Array.from(document.querySelectorAll(cssSelector));
                  element = elements.find(el => el.textContent?.trim() === textContent);
                }
                // Handle placeholder-based selectors
                else if (selector.startsWith('placeholder:')) {
                  const placeholder = selector.substring(12);
                  element = document.querySelector('[placeholder="' + placeholder + '"]');
                }
                // Handle aria-label selectors
                else if (selector.startsWith('aria-label:')) {
                  const ariaLabel = selector.substring(11);
                  element = document.querySelector('[aria-label="' + ariaLabel + '"]');
                }
                // Standard CSS selector
                else {
                  element = document.querySelector(selector);
                }

                if (element) {
                  return element;
                }
              } catch (e) {
                console.log('[Recorder] Selector error on attempt ' + (i + 1) + ':', e.message);
              }

              // Wait before retry (increasing wait time)
              if (i < retries - 1) {
                await wait(1000 * (i + 1)); // 1s, 2s, 3s
                console.log('[Recorder] Retrying element search, attempt ' + (i + 2));
              }
            }
            return null;
          };

          // Find element with retries
          const element = await findElement();

          if (!element) {
            return { success: false, error: 'Element not found after retries: ' + step.selector };
          }

          // Highlight the element
          const originalOutline = element.style.outline;
          const originalBackground = element.style.backgroundColor;
          element.style.outline = '3px solid #f59e0b';
          element.style.backgroundColor = '#fef3c7';

          // Scroll element into view and wait for scroll to complete
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await wait(500); // Wait for scroll animation

          // Execute the action
          try {
            if (step.type === 'click') {
              element.click();
              // Wait longer after clicks to allow page navigation/updates
              await wait(1500);
            } else if (step.type === 'input') {
              // Focus the element first
              element.focus();
              await wait(200);

              // Clear existing value using React/framework-friendly method
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value'
              ).set;

              nativeInputValueSetter.call(element, '');
              element.dispatchEvent(new Event('input', { bubbles: true }));
              await wait(100);

              // Set new value using native setter (works with React/Vue/Angular)
              nativeInputValueSetter.call(element, step.value);

              // Dispatch comprehensive events for framework compatibility
              // InputEvent with data (for React)
              element.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                data: step.value,
                inputType: 'insertText'
              }));

              // Standard events
              element.dispatchEvent(new Event('change', { bubbles: true }));
              element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
              element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
              element.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true }));

              // Blur to trigger validation
              await wait(200);
              element.blur();

              // Wait for UI to update after input
              await wait(1000);
            } else if (step.type === 'select') {
              element.value = step.value;
              element.dispatchEvent(new Event('change', { bubbles: true }));
              await wait(500);
            }

            // Remove highlight
            element.style.outline = originalOutline;
            element.style.backgroundColor = originalBackground;

            return { success: true };
          } catch (e) {
            return { success: false, error: 'Failed to execute action: ' + e.message };
          }
        })();
      `);

      // Add additional wait time on the main process side to ensure page is fully loaded
      await new Promise(resolve => setTimeout(resolve, 500));

      return result;
    } catch (error) {
      console.error('[Browser] Error executing step:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('browser:prompt-sensitive-input', async (_, label: string, stepNumber: number, totalSteps: number): Promise<string> => {
    try {
      if (!browserView || browserView.webContents.isDestroyed()) {
        throw new Error('Browser view not available');
      }

      console.log('[Browser] Showing sensitive input prompt');

      const promptCode = `
        (function() {
          return new Promise((resolve) => {
            // Remove existing prompt if present
            const existing = document.getElementById('sensitive-input-overlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'sensitive-input-overlay';
            overlay.innerHTML = \`
              <style>
                #sensitive-input-overlay {
                  position: fixed;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  z-index: 2147483647;
                  background: rgba(0, 0, 0, 0.8);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  animation: fadeIn 0.2s ease-out;
                }

                @keyframes fadeIn {
                  from { opacity: 0; }
                  to { opacity: 1; }
                }

                #sensitive-input-box {
                  background: white;
                  border-radius: 12px;
                  padding: 32px;
                  max-width: 500px;
                  width: 90%;
                  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                  animation: slideUp 0.3s ease-out;
                }

                @keyframes slideUp {
                  from {
                    opacity: 0;
                    transform: translateY(20px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }

                #sensitive-input-box h2 {
                  margin: 0 0 8px 0;
                  font-size: 24px;
                  color: #1f2937;
                  display: flex;
                  align-items: center;
                  gap: 12px;
                }

                #sensitive-input-box .step-info {
                  color: #6b7280;
                  font-size: 14px;
                  margin-bottom: 20px;
                }

                #sensitive-input-box .field-label {
                  color: #374151;
                  font-size: 15px;
                  margin-bottom: 16px;
                  padding: 12px;
                  background: #f3f4f6;
                  border-radius: 6px;
                  border-left: 3px solid #3b82f6;
                }

                #sensitive-input-box .alert {
                  background: #dbeafe;
                  border: 1px solid #93c5fd;
                  color: #1e40af;
                  padding: 12px;
                  border-radius: 6px;
                  margin-bottom: 20px;
                  font-size: 13px;
                  display: flex;
                  gap: 8px;
                }

                #sensitive-input-box input {
                  width: 100%;
                  padding: 14px;
                  border: 2px solid #d1d5db;
                  border-radius: 8px;
                  font-size: 16px;
                  box-sizing: border-box;
                  margin-bottom: 20px;
                  transition: border-color 0.2s;
                }

                #sensitive-input-box input:focus {
                  outline: none;
                  border-color: #3b82f6;
                  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }

                #sensitive-input-box button {
                  width: 100%;
                  padding: 14px 24px;
                  background: #3b82f6;
                  color: white;
                  border: none;
                  border-radius: 8px;
                  font-size: 16px;
                  font-weight: 600;
                  cursor: pointer;
                  transition: all 0.2s;
                }

                #sensitive-input-box button:hover:not(:disabled) {
                  background: #2563eb;
                  transform: translateY(-1px);
                  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                }

                #sensitive-input-box button:active:not(:disabled) {
                  transform: translateY(0);
                }

                #sensitive-input-box button:disabled {
                  background: #9ca3af;
                  cursor: not-allowed;
                }

                .lock-icon {
                  display: inline-block;
                  width: 28px;
                  height: 28px;
                  background: #fbbf24;
                  border-radius: 50%;
                  position: relative;
                }

                .lock-icon::before {
                  content: '🔒';
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  font-size: 14px;
                }
              </style>

              <div id="sensitive-input-box">
                <h2>
                  <span class="lock-icon"></span>
                  Sensitive Input Required
                </h2>
                <div class="step-info">Step ${stepNumber} of ${totalSteps}</div>
                <div class="field-label">${label.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                <div class="alert">
                  <span>ℹ️</span>
                  <div>
                    <strong>Privacy Note:</strong> This value is not stored and only used for this playback session.
                    ${label.toLowerCase().includes('pin') ? '<br><strong>For separate PIN boxes:</strong> Enter one digit at a time.' : ''}
                  </div>
                </div>
                <input
                  type="password"
                  id="sensitive-value-input"
                  placeholder="Enter value..."
                  autocomplete="off"
                />
                <button id="submit-sensitive-value" disabled>Continue</button>
              </div>
            \`;

            document.body.appendChild(overlay);

            const input = document.getElementById('sensitive-value-input');
            const button = document.getElementById('submit-sensitive-value');

            // Focus input
            setTimeout(() => input.focus(), 100);

            // Enable button when input has value
            input.addEventListener('input', () => {
              button.disabled = !input.value.trim();
            });

            // Handle submit
            function submit() {
              const value = input.value.trim();
              if (value) {
                overlay.remove();
                resolve(value);
              }
            }

            button.addEventListener('click', submit);
            input.addEventListener('keypress', (e) => {
              if (e.key === 'Enter') {
                submit();
              }
            });
          });
        })();
      `;

      const value = await browserView.webContents.executeJavaScript(promptCode);
      console.log('[Browser] Received sensitive input, length:', (value as string).length);
      return value as string;
    } catch (error) {
      console.error('[Browser] Error prompting for sensitive input:', error);
      throw error;
    }
  });

  ipcMain.handle('browser:stop-recording', async () => {
    try {
      if (!browserView || browserView.webContents.isDestroyed()) {
        return { success: false, error: 'Browser view not available' };
      }

      console.log('[Browser] Stopping recording in browser view');

      // Remove console message listener
      const listener = (browserView as any)._recorderListener;
      if (listener) {
        browserView.webContents.removeListener('console-message', listener);
        delete (browserView as any)._recorderListener;
      }

      // Remove navigation listeners
      const didFinishLoadListener = (browserView as any)._recorderDidFinishLoadListener;
      if (didFinishLoadListener) {
        browserView.webContents.removeListener('did-finish-load', didFinishLoadListener);
        delete (browserView as any)._recorderDidFinishLoadListener;
      }

      const didNavigateListener = (browserView as any)._recorderDidNavigateListener;
      if (didNavigateListener) {
        browserView.webContents.removeListener('did-navigate-in-page', didNavigateListener);
        delete (browserView as any)._recorderDidNavigateListener;
      }

      // Try to remove the recorder script event listeners (non-blocking)
      try {
        await browserView.webContents.executeJavaScript(`
          const cleanup = window[Symbol.for('__rec_cleanup__')];
          if (cleanup) cleanup();
        `);
      } catch (cleanupError) {
        // Ignore cleanup errors - recording is already captured
        console.log('[Browser] Cleanup error (non-critical):', cleanupError);
      }

      // Return the recording
      const recording = currentRecording;
      currentRecording = null;

      console.log('[Browser] Recording stopped with', recording?.interactions?.length || 0, 'interactions');

      return {
        success: true,
        recording,
      };
    } catch (error) {
      console.error('[Browser] Error stopping recording:', error);
      return { success: false, error: String(error) };
    }
  });

  console.log('Recorder IPC handlers registered');
}
