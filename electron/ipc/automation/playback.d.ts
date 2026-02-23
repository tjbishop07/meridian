import type { BrowserWindow } from 'electron';
import type { RecordingStep } from './types';
/**
 * Reset page tracking state (call this when starting a new playback)
 */
export declare function resetPageTracking(): void;
/**
 * Execute a single automation step with retry logic
 * Uses text-based identification with coordinate fallback for resilient playback
 */
export declare function executeStep(window: BrowserWindow, step: RecordingStep): Promise<void>;
