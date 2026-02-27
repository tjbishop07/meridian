import { vi } from 'vitest';

// Mock the electron module to prevent errors when modules that transitively
// import from electron are loaded (e.g. electron/db/index.ts → app.getPath)
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp/test-meridian'),
    isReady: vi.fn().mockReturnValue(true),
    getName: vi.fn().mockReturnValue('Meridian'),
    getVersion: vi.fn().mockReturnValue('0.0.0-test'),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}));

// Suppress console output in tests to keep output clean
// (query modules log various messages via console.log)
vi.spyOn(console, 'log').mockImplementation(() => {});
