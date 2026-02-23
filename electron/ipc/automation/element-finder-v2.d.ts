/**
 * Element Finder V2 - Confidence-based element matching
 *
 * Finds elements using multi-attribute scoring to ensure high-confidence matches only
 */
import type { ElementIdentification } from './element-finder';
/**
 * Generate improved element finder script with confidence scoring
 * Only returns elements with confidence >= 70%
 */
export declare function generateConfidenceElementFinderScript(identification: ElementIdentification): string;
