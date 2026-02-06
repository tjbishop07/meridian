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

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.cjs');
  console.log('Preload path:', preloadPath);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
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

  console.log('Main window created');
}

// Initialize app
app.whenReady().then(() => {
  try {
    // Initialize database
    initDatabase();

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

    // File dialog handler
    ipcMain.handle('dialog:open-file', async (_, options) => {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile'],
        filters: options.filters,
      });

      return result.canceled ? null : result.filePaths[0];
    });

    // Create main window
    createWindow();

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
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});
