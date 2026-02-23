import { BrowserWindow } from 'electron';
export declare function setMainWindow(window: BrowserWindow): void;
export declare function registerOllamaHandlers(): void;
export declare function checkServerRunning(): Promise<boolean>;
