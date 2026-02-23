import { app, BrowserWindow, dialog, ipcMain, Tray, Menu, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { initDatabase, closeDatabase } from './db';
import { registerTransactionHandlers } from './ipc/transactions';
import { registerAccountHandlers } from './ipc/accounts';
import { registerCategoryHandlers } from './ipc/categories';
import { registerImportHandlers } from './ipc/import';
import { registerAnalyticsHandlers } from './ipc/analytics';
import { registerBudgetHandlers } from './ipc/budgets';
import { registerGoalHandlers } from './ipc/goals';
import { registerBillHandlers } from './ipc/bills';
import { registerSettingsHandlers } from './ipc/settings';
import { registerRecorderHandlers } from './ipc/recorder';
import { registerExportRecipeHandlers } from './ipc/export-recipes';
import { registerAutomationHandlers, setMainWindow } from './ipc/automation/index';
import { initScheduler } from './ipc/automation/scheduler';
import { registerScraperHandlers, setMainWindow as setScraperMainWindow } from './ipc/scraper';
import { registerAIScraperHandlers, setMainWindow as setAIScraperMainWindow } from './ipc/ai-scraper';
import { registerOllamaHandlers, setMainWindow as setOllamaMainWindow, checkServerRunning } from './ipc/ollama';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { registerPuppeteerScraperHandlers, setMainWindow as setPuppeteerMainWindow } from './ipc/puppeteer-scraper';
import { registerAutomationSettingsHandlers } from './ipc/automation-settings';
import { registerTagHandlers } from './ipc/tags';
import { registerReceiptHandlers, setReceiptMainWindow } from './ipc/receipt';
import { runAllNow } from './ipc/automation/scheduler';
import sharp from 'sharp';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Keep a global reference of the window objects
let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Meridian tray icon SVG (black template image for macOS)
const TRAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" fill="none">
  <line x1="2" y1="18" x2="20" y2="18" stroke="black" stroke-width="1.1" stroke-linecap="round" opacity="0.5"/>
  <path d="M3 18 Q11 4.5 19 18" stroke="black" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <circle cx="11" cy="5" r="1.6" fill="black"/>
</svg>`;

async function createTrayIcon(): Promise<Tray> {
  let icon: Electron.NativeImage;
  try {
    const pngBuffer = await sharp(Buffer.from(TRAY_SVG), { density: 144 })
      .resize(22, 22)
      .png()
      .toBuffer();
    icon = nativeImage.createFromBuffer(pngBuffer, { scaleFactor: 2 });
    icon.setTemplateImage(true);
  } catch {
    icon = nativeImage.createEmpty();
  }

  const t = new Tray(icon);
  t.setToolTip('Meridian');
  return t;
}

function buildTrayMenu(): Electron.Menu {
  const launchAtLogin = app.getLoginItemSettings().openAtLogin;
  return Menu.buildFromTemplate([
    {
      label: 'Open Meridian',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Run All Recordings Now',
      click: () => {
        runAllNow().catch(console.error);
      },
    },
    { type: 'separator' },
    {
      label: 'Launch at Login',
      type: 'checkbox',
      checked: launchAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
        // Rebuild the menu so the checkbox state updates
        if (tray) tray.setContextMenu(buildTrayMenu());
      },
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => {
        if (!isDev) {
          autoUpdater.checkForUpdates().catch(console.error);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Meridian',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

const isDev = process.env.NODE_ENV === 'development';

async function updateSplashStatus(message: string): Promise<void> {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  try {
    await splashWindow.webContents.executeJavaScript(`
      const el = document.getElementById('ollama-status');
      if (el) el.textContent = ${JSON.stringify(message)};
    `);
  } catch {
    // Splash may have already closed
  }
}

async function initOllama(): Promise<void> {
  try {
    await updateSplashStatus('Detecting local AI...');

    // Check if Ollama is installed
    let installed = false;
    try {
      await execAsync('which ollama');
      installed = true;
    } catch {
      installed = false;
    }

    if (!installed) {
      await updateSplashStatus('Local AI not found');
      return;
    }

    // Check if server is already running
    let running = await checkServerRunning();

    // Auto-start if installed but not running
    if (!running) {
      await updateSplashStatus('Starting Ollama server...');
      spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' }).unref();

      // Poll for up to 4 seconds
      for (let i = 0; i < 4; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        running = await checkServerRunning();
        if (running) break;
      }
    }

    if (!running) {
      await updateSplashStatus('Ollama offline');
      return;
    }

    // Fetch available models
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();
    const models: string[] = [...new Set<string>(
      (data.models || []).map((m: any) => m.name.split(':')[0])
    )];

    if (models.length === 0) {
      await updateSplashStatus('Ollama ready — no models installed');
    } else {
      await updateSplashStatus(`Ollama ready — ${models.join(', ')}`);
    }
  } catch (error) {
    console.error('[Main] Ollama init error:', error);
    await updateSplashStatus('Local AI unavailable');
  }
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 600,
    height: 700,
    frame: false,
    backgroundColor: '#667eea',
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load splash screen with inline HTML to avoid file path issues
  const splashHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
        body {
          background: radial-gradient(circle at 50% 50%, #0f172a 0%, #020617 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          overflow: hidden;
          position: relative;
        }

        .splash-container {
          text-align: center;
          z-index: 10;
          animation: fadeIn 0.8s ease-out;
        }

        /* Animated meridian icon */
        .meridian-icon {
          width: 120px;
          height: 120px;
          margin: 0 auto 40px;
          display: block;
          transform-origin: center;
          animation: meridian-rise 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
          filter: drop-shadow(0 0 20px rgba(74, 222, 128, 0.4));
        }

        @keyframes meridian-rise {
          from {
            transform: translateY(20px) scale(0.85);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        .app-name {
          color: #ffffff;
          font-size: 52px;
          font-weight: 800;
          margin-bottom: 12px;
          letter-spacing: -1.5px;
          animation: slideUp 0.8s ease-out 1s both;
          background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .app-tagline {
          color: #94a3b8;
          font-size: 18px;
          font-weight: 500;
          margin-bottom: 50px;
          animation: slideUp 0.8s ease-out 1.2s both;
          letter-spacing: 0.5px;
        }

        .loading-bar {
          width: 200px;
          height: 4px;
          background: rgba(148, 163, 184, 0.2);
          border-radius: 2px;
          margin: 0 auto;
          overflow: hidden;
          animation: slideUp 0.8s ease-out 1.4s both;
        }

        .loading-progress {
          height: 100%;
          background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
          border-radius: 2px;
          animation: progress 2s ease-in-out infinite;
          box-shadow: 0 0 10px rgba(74, 222, 128, 0.5);
        }

        @keyframes progress {
          0% { width: 0%; transform: translateX(0); }
          50% { width: 70%; transform: translateX(0); }
          100% { width: 100%; transform: translateX(0); }
        }

        .loading-text {
          color: #64748b;
          font-size: 13px;
          margin-top: 16px;
          font-weight: 500;
          animation: slideUp 0.8s ease-out 1.6s both, pulse 2s ease-in-out 2s infinite;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .ollama-status {
          color: #4ade80;
          font-size: 12px;
          margin-top: 10px;
          font-weight: 400;
          letter-spacing: 0.3px;
          animation: slideUp 0.8s ease-out 1.9s both;
          min-height: 16px;
          opacity: 0.85;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
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

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        body.fade-out {
          animation: fadeOut 0.5s ease-out forwards;
        }

        @keyframes fadeOut {
          to { opacity: 0; }
        }
      </style>
    </head>
    <body>
      <div class="splash-container">
        <svg class="meridian-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
          <line x1="2" y1="19.5" x2="22" y2="19.5" stroke="#4ade80" stroke-width="1.1" stroke-linecap="round" opacity="0.35"/>
          <path d="M3 19.5 Q12 3 21 19.5" stroke="#22c55e" stroke-width="1.6" fill="none" stroke-linecap="round"/>
          <circle cx="12" cy="5.5" r="1.8" fill="#4ade80"/>
        </svg>
        <h1 class="app-name">Meridian</h1>
        <p class="app-tagline">find your financial north</p>
        <div class="loading-bar">
          <div class="loading-progress"></div>
        </div>
        <p class="loading-text">Loading</p>
        <p id="ollama-status" class="ollama-status"></p>
      </div>
    </body>
    </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
  splashWindow.center();

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.cjs');
  console.log('Preload path:', preloadPath);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    show: false, // Start hidden, will show after splash
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for better-sqlite3
    },
    title: 'Meridian',
    backgroundColor: '#1d232a',
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools(); // Disabled by default - use Cmd+Option+I to open manually
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      // Hide to tray instead of closing
      e.preventDefault();
      mainWindow?.hide();
    } else {
      mainWindow = null;
    }
  });

  // When main window is ready to show, close splash and show main
  mainWindow.once('ready-to-show', () => {
    console.log('Main window ready to show');

    // Minimum splash screen display time (3.5 seconds to show Ollama status)
    setTimeout(() => {
      // Fade out splash
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.executeJavaScript(`
          document.body.classList.add('fade-out');
        `).catch(() => {});

        // Close splash after fade animation
        setTimeout(() => {
          if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
          }

          // Show main window
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
          }
        }, 500);
      } else {
        // If splash is already closed, just show main window
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    }, 3500);
  });

  console.log('Main window created');
}

// Initialize app
app.whenReady().then(async () => {
  try {
    // Show splash screen immediately
    createSplashWindow();

    // Start Ollama detection in background (updates splash as it progresses)
    initOllama().catch(console.error);

    // Initialize database
    const db = initDatabase();

    // Register IPC handlers
    registerTransactionHandlers();
    registerAccountHandlers();
    registerCategoryHandlers();
    registerImportHandlers();
    registerAnalyticsHandlers();
    registerBudgetHandlers();
    registerGoalHandlers();
    registerBillHandlers();
    registerSettingsHandlers();
    registerRecorderHandlers();
    registerExportRecipeHandlers();

    console.log('[Main] Registering automation handlers...');
    registerAutomationHandlers();
    initScheduler();
    registerAutomationSettingsHandlers();
    registerScraperHandlers();
    registerAIScraperHandlers();
    registerOllamaHandlers();
    registerPuppeteerScraperHandlers();
    registerTagHandlers();
    registerReceiptHandlers();
    console.log('[Main] Automation, scraper, Ollama, Puppeteer, tag, and receipt handlers registered');

    // File dialog handler
    ipcMain.handle('dialog:open-file', async (_, options) => {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile'],
        filters: options.filters,
      });

      return result.canceled ? null : result.filePaths[0];
    });

    // Create main window (will be shown after splash)
    createWindow();

    // Create system tray
    tray = await createTrayIcon();
    tray.setContextMenu(buildTrayMenu());
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    // Launch at login IPC handlers
    ipcMain.handle('app:get-launch-at-login', () => {
      return app.getLoginItemSettings().openAtLogin;
    });

    ipcMain.handle('app:set-launch-at-login', (_, enabled: boolean) => {
      app.setLoginItemSettings({ openAtLogin: enabled });
      // Rebuild tray menu so checkbox stays in sync
      if (tray) tray.setContextMenu(buildTrayMenu());
      return enabled;
    });

    // Auto-updater
    if (!isDev) {
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = false;

      autoUpdater.on('update-downloaded', (info) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app:update-downloaded', info.version);
        }
      });

      autoUpdater.checkForUpdates().catch(console.error);
    }

    ipcMain.handle('app:check-for-updates', async () => {
      if (isDev) return { updateAvailable: false };
      const result = await autoUpdater.checkForUpdates();
      return { updateAvailable: !!result?.updateInfo };
    });

    ipcMain.handle('app:install-update', () => {
      isQuitting = true;
      autoUpdater.quitAndInstall();
    });

    // Set main window reference for automation and scraper handlers
    if (mainWindow) {
      setMainWindow(mainWindow);
      setScraperMainWindow(mainWindow);
      setAIScraperMainWindow(mainWindow);
      setOllamaMainWindow(mainWindow);
      setPuppeteerMainWindow(mainWindow);
      setReceiptMainWindow(mainWindow);
    }

    app.on('activate', () => {
      // Show the window when the dock icon is clicked (it's hidden, not destroyed)
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
      }
    });

    console.log('App initialized successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
});

// App lives in the system tray — never quit when windows close
app.on('window-all-closed', () => {
  // Intentionally empty: the tray keeps the app running
});

// Clean up before quit
app.on('before-quit', () => {
  isQuitting = true;
  if (tray) {
    tray.destroy();
    tray = null;
  }
  closeDatabase();

  // Clean up browser view if it exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('app:closing');
    } catch (error) {
      console.error('Error sending app closing event:', error);
    }
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});
