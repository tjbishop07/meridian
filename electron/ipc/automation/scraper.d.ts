import type { BrowserWindow } from 'electron';
import type { ScrapedTransaction } from './types';
/**
 * Scrape transactions from the current page in the playback window
 * Uses vision-first approach with DOM extraction as fallback
 * Returns transactions and the method used
 */
export declare function scrapeTransactions(window: BrowserWindow): Promise<{
    transactions: ScrapedTransaction[];
    method: string;
}>;
/**
 * Scrape transactions using DOM extraction (legacy method)
 * Uses smart text cleaning to handle nested elements
 */
export declare function scrapeWithDOM(window: BrowserWindow): Promise<ScrapedTransaction[]>;
