import { BrowserWindow } from 'electron';
export declare function createRecordingWindow(startUrl?: string, accountId?: number | null): Promise<{
    success: boolean;
}>;
export declare function setMainWindow(window: BrowserWindow): void;
export declare function registerRecordingHandlers(): void;
