/**
 * Element Finder - Text-based element identification
 *
 * Finds elements using text content, ARIA labels, and other semantic attributes
 * instead of brittle selectors or coordinates.
 */
export interface ElementIdentification {
    text?: string;
    ariaLabel?: string;
    placeholder?: string;
    title?: string;
    role?: string;
    nearbyLabels?: string[];
    href?: string | null;
    parentRole?: string;
    parentClass?: string | null;
    isVisible?: boolean;
    elementSize?: {
        width: number;
        height: number;
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
}
/**
 * Generate element identification data during recording
 * This runs in the browser context
 */
export declare function generateElementIdentificationScript(elementSelector: string): string;
/**
 * Find element using text-based strategies
 * This script runs in the browser during playback
 */
export declare function generateElementFinderScript(identification: ElementIdentification): string;
/**
 * Extract element identification from a step
 * For backward compatibility with old recordings
 */
export declare function extractIdentification(step: any): ElementIdentification;
