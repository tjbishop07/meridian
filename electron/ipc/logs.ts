import { ipcMain, BrowserWindow } from 'electron';

export type LogLevel = 'debug' | 'info' | 'success' | 'warning' | 'error';
export type LogSource = 'App' | 'Updater' | 'Automation' | 'Scheduler' | 'Scraper';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: LogSource | string;
  message: string;
}

const MAX_ENTRIES = 500;
const logStore: LogEntry[] = [];
let logWindow: BrowserWindow | null = null;

export function setLogWindow(win: BrowserWindow): void {
  logWindow = win;
}

export function addLog(level: LogLevel, source: LogSource | string, message: string): void {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
  };

  logStore.push(entry);
  if (logStore.length > MAX_ENTRIES) {
    logStore.shift();
  }

  if (logWindow && !logWindow.isDestroyed()) {
    try {
      logWindow.webContents.send('logs:new-entry', entry);
    } catch {
      // Window may be closing
    }
  }
}

export function registerLogHandlers(): void {
  ipcMain.handle('logs:get-all', () => {
    return [...logStore];
  });

  ipcMain.handle('logs:clear', () => {
    logStore.length = 0;
  });
}
