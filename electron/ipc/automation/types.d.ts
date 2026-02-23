import type { BrowserWindow } from 'electron';
export interface RecordingStep {
    type: 'click' | 'input' | 'select' | 'navigation';
    selector?: string;
    element?: string;
    value?: string;
    url?: string;
    timestamp?: number;
    identification?: {
        text?: string;
        ariaLabel?: string;
        placeholder?: string;
        title?: string;
        role?: string;
        nearbyLabels?: string[];
        coordinates?: {
            x: number;
            y: number;
            elementX?: number;
            elementY?: number;
        };
        viewport?: {
            width: number;
            height: number;
            scrollX: number;
            scrollY: number;
        };
    };
    coordinates?: {
        x: number;
        y: number;
        elementX?: number;
        elementY?: number;
    };
    viewport?: {
        width: number;
        height: number;
        scrollX: number;
        scrollY: number;
    };
    isSensitive?: boolean;
    fieldLabel?: string;
}
export interface PlaybackState {
    recipeId: string;
    currentStep: number;
    totalSteps: number;
    awaitingInput?: boolean;
    inputResolver?: ((value: string) => void) | null;
}
export interface ScrapedTransaction {
    date: string;
    description: string;
    amount: string;
    balance: string;
    category: string;
    index: number;
    confidence: number;
}
export interface RecorderState {
    recording: boolean;
    steps: RecordingStep[];
    startUrl: string;
    lastInteraction?: RecordingStep;
    lastTimestamp: number;
}
export interface WindowRefs {
    mainWindow: BrowserWindow | null;
    recordingWindow: BrowserWindow | null;
    playbackWindow: BrowserWindow | null;
}
