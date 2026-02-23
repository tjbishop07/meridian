/**
 * Automation Module - Main Entry Point
 *
 * Handles browser automation for recording and playing back user interactions.
 * Coordinates between recording, playback, scraping, and AI cleanup modules.
 */
import { BrowserWindow } from 'electron';
/**
 * Set the main application window reference
 */
export declare function setMainWindow(window: BrowserWindow): void;
/**
 * Register all automation IPC handlers
 */
export declare function registerAutomationHandlers(): void;
/**
 * Play a recorded automation recipe
 */
export declare function playRecording(recipeId: string): Promise<{
    success: boolean;
    message?: string;
}>;
