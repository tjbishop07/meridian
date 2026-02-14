import { app, BrowserWindow, dialog, ipcMain } from 'electron';
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
import { registerScraperHandlers, setMainWindow as setScraperMainWindow } from './ipc/scraper';
import { registerAIScraperHandlers, setMainWindow as setAIScraperMainWindow } from './ipc/ai-scraper';
import { registerOllamaHandlers, setMainWindow as setOllamaMainWindow } from './ipc/ollama';
import { registerPuppeteerScraperHandlers, setMainWindow as setPuppeteerMainWindow } from './ipc/puppeteer-scraper';
import { registerAutomationSettingsHandlers } from './ipc/automation-settings';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Keep a global reference of the window objects
let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

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

        /* Floating particles */
        .particle {
          position: absolute;
          font-size: 24px;
          opacity: 0;
          animation: float-up 4s ease-in-out infinite;
        }
        .particle:nth-child(1) { left: 10%; animation-delay: 0s; }
        .particle:nth-child(2) { left: 20%; animation-delay: 0.5s; }
        .particle:nth-child(3) { left: 30%; animation-delay: 1s; }
        .particle:nth-child(4) { left: 40%; animation-delay: 1.5s; }
        .particle:nth-child(5) { left: 60%; animation-delay: 0.3s; }
        .particle:nth-child(6) { left: 70%; animation-delay: 0.8s; }
        .particle:nth-child(7) { left: 80%; animation-delay: 1.3s; }
        .particle:nth-child(8) { left: 90%; animation-delay: 1.8s; }

        @keyframes float-up {
          0% {
            transform: translateY(100vh) rotate(0deg) scale(0.5);
            opacity: 0;
          }
          10% { opacity: 0.6; }
          90% { opacity: 0.6; }
          100% {
            transform: translateY(-100px) rotate(360deg) scale(1);
            opacity: 0;
          }
        }

        .splash-container {
          text-align: center;
          z-index: 10;
          animation: fadeIn 0.8s ease-out;
        }

        /* Animated coin stack */
        .coin-stack {
          position: relative;
          width: 180px;
          height: 180px;
          margin: 0 auto 40px;
        }

        .coin {
          position: absolute;
          width: 120px;
          height: 40px;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
          border-radius: 50%;
          box-shadow:
            0 4px 0 #b45309,
            0 8px 20px rgba(251, 191, 36, 0.4),
            inset 0 -2px 4px rgba(0,0,0,0.2),
            inset 0 2px 4px rgba(255,255,255,0.3);
          left: 50%;
          transform: translateX(-50%);
        }

        .coin::before {
          content: '$';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 24px;
          font-weight: bold;
          color: #78350f;
          text-shadow: 0 1px 0 rgba(255,255,255,0.3);
        }

        .coin:nth-child(1) {
          bottom: 60px;
          animation: coin-appear 0.6s ease-out 0.2s both, coin-glow 2s ease-in-out 0.8s infinite;
        }
        .coin:nth-child(2) {
          bottom: 40px;
          animation: coin-appear 0.6s ease-out 0.4s both;
        }
        .coin:nth-child(3) {
          bottom: 20px;
          animation: coin-appear 0.6s ease-out 0.6s both;
        }
        .coin:nth-child(4) {
          bottom: 0;
          animation: coin-appear 0.6s ease-out 0.8s both;
        }

        @keyframes coin-appear {
          from {
            transform: translateX(-50%) translateY(-30px) scale(0.8);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0) scale(1);
            opacity: 1;
          }
        }

        @keyframes coin-glow {
          0%, 100% {
            box-shadow:
              0 4px 0 #b45309,
              0 8px 20px rgba(251, 191, 36, 0.4),
              inset 0 -2px 4px rgba(0,0,0,0.2),
              inset 0 2px 4px rgba(255,255,255,0.3);
          }
          50% {
            box-shadow:
              0 4px 0 #b45309,
              0 8px 40px rgba(251, 191, 36, 0.8),
              0 0 60px rgba(251, 191, 36, 0.4),
              inset 0 -2px 4px rgba(0,0,0,0.2),
              inset 0 2px 4px rgba(255,255,255,0.3);
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
          background: linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%);
          border-radius: 2px;
          animation: progress 2s ease-in-out infinite;
          box-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
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
      <div class="particle">💵</div>
      <div class="particle">💰</div>
      <div class="particle">💎</div>
      <div class="particle">💳</div>
      <div class="particle">📊</div>
      <div class="particle">📈</div>
      <div class="particle">💵</div>
      <div class="particle">💰</div>

      <div class="splash-container">
        <div class="coin-stack">
          <div class="coin"></div>
          <div class="coin"></div>
          <div class="coin"></div>
          <div class="coin"></div>
        </div>
        <h1 class="app-name">Personal Finance</h1>
        <p class="app-tagline">Your smart financial companion</p>
        <div class="loading-bar">
          <div class="loading-progress"></div>
        </div>
        <p class="loading-text">Loading</p>
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
    title: 'Personal Finance',
    backgroundColor: '#1d232a',
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // When main window is ready to show, close splash and show main
  mainWindow.once('ready-to-show', () => {
    console.log('Main window ready to show');

    // Minimum splash screen display time (2 seconds)
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
    }, 2000);
  });

  console.log('Main window created');
}

// Initialize app
app.whenReady().then(async () => {
  try {
    // Show splash screen immediately
    createSplashWindow();

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
    registerAutomationSettingsHandlers();
    registerScraperHandlers();
    registerAIScraperHandlers();
    registerOllamaHandlers();
    registerPuppeteerScraperHandlers();
    console.log('[Main] Automation, scraper, Ollama, and Puppeteer handlers registered');

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

    // Set main window reference for automation and scraper handlers
    if (mainWindow) {
      setMainWindow(mainWindow);
      setScraperMainWindow(mainWindow);
      setAIScraperMainWindow(mainWindow);
      setOllamaMainWindow(mainWindow);
      setPuppeteerMainWindow(mainWindow);
    }

    app.on('activate', () => {
      // On macOS it's common to re-create a window when the dock icon is clicked
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });

    console.log('App initialized successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS it's common for applications to stay open until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up before quit
app.on('before-quit', () => {
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
