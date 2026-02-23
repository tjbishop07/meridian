import type { ScrapedTransaction } from './types';
/**
 * Clean up scraped transactions using AI (Ollama)
 * - Normalizes category names (removes trailing numbers like "Television 0")
 * - Cleans up descriptions (removes bank jargon)
 * - Detects and removes duplicates
 * - Standardizes formatting
 */
export declare function cleanTransactionsWithAI(transactions: ScrapedTransaction[], statusCallback?: (msg: string) => Promise<void>): Promise<ScrapedTransaction[]>;
/**
 * Check if Ollama is running and start it if needed
 */
export declare function ensureOllamaRunning(): Promise<boolean>;
