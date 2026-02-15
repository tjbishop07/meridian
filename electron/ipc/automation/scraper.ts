import type { BrowserWindow } from 'electron';
import type { ScrapedTransaction } from './types';
import { scrapeWithVision, type VisionConfig } from './vision-scraper';
import { getDatabase } from '../../db';
import { getAutomationSettings } from '../../db/queries/automation-settings';

/**
 * Scrape transactions from the current page in the playback window
 * Uses vision-first approach with DOM extraction as fallback
 */
export async function scrapeTransactions(window: BrowserWindow): Promise<ScrapedTransaction[]> {
  const db = getDatabase();
  const settings = getAutomationSettings(db);

  // Try vision scraping first if enabled and configured
  if (settings.vision_provider === 'claude' && settings.claude_api_key) {
    console.log('[Scraper] Attempting vision-based scraping with Claude...');
    try {
      const visionConfig: VisionConfig = {
        provider: 'claude',
        apiKey: settings.claude_api_key,
        model: settings.claude_model || 'claude-3-5-sonnet-20241022',
      };

      const transactions = await scrapeWithVision(window, visionConfig);

      if (transactions.length > 0) {
        console.log('[Scraper] ✓ Vision scraping succeeded with', transactions.length, 'transactions');
        return transactions;
      } else {
        console.log('[Scraper] ⚠️ Vision scraping returned 0 transactions, falling back to DOM');
      }
    } catch (error) {
      console.warn('[Scraper] ⚠️ Vision scraping failed, falling back to DOM:', error instanceof Error ? error.message : String(error));
    }
  } else {
    console.log('[Scraper] Vision scraping disabled or not configured, using DOM extraction');
  }

  // Fallback to DOM scraping
  return scrapeWithDOM(window);
}

/**
 * Scrape transactions using DOM extraction (legacy method)
 * Uses smart text cleaning to handle nested elements
 */
export async function scrapeWithDOM(window: BrowserWindow): Promise<ScrapedTransaction[]> {
  console.log('[Scraper] Extracting transactions directly from DOM...');

  const scrapedTransactions = await window.webContents.executeJavaScript(`
    (function() {
      const transactions = [];

      // Helper function to extract clean text from elements
      // Handles cases where multiple text nodes or nested elements cause duplication
      function getCleanText(element) {
        if (!element) return '';

        let text = element.innerText || element.textContent || '';
        text = text.trim();

        // Detect and fix concatenated dates (e.g., "Feb 04, 2026February 04 2026")
        const datePattern = /^([A-Za-z]{3}\\s+\\d{1,2},\\s+\\d{4})/;
        const dateMatch = text.match(datePattern);
        if (dateMatch) {
          // Take only the first date format
          text = dateMatch[1];
        }

        // Detect and fix concatenated amounts (e.g., "-206.422380.52")
        // Look for pattern like "-123.45" followed by more digits
        const amountPattern = /^(-?\\$?[\\d,]+\\.\\d{2})/;
        const amountMatch = text.match(amountPattern);
        if (amountMatch && text.length > amountMatch[0].length) {
          // Text continues after valid amount - probably concatenated with balance
          text = amountMatch[1];
        }

        return text;
      }

      // Helper to get first child text only (avoid nested element text)
      function getDirectText(element) {
        if (!element) return '';

        // Try to get text from first direct child if it exists
        const firstChild = element.querySelector(':scope > span, :scope > div, :scope > time');
        if (firstChild) {
          return getCleanText(firstChild);
        }

        return getCleanText(element);
      }

      // Try multiple selector strategies for different bank websites
      const strategies = [
        // Strategy 1: data-testid attributes (USAA, modern banks)
        {
          name: 'data-testid',
          rowSelector: 'tr[data-testid*="transaction-row"]',
          extract: (row) => {
            const cells = row.querySelectorAll('td');
            let date = '', description = '', amount = '', balance = '', category = '';

            // Look for date in various places
            const dateCell = row.querySelector('[class*="date"]') || cells[0];
            if (dateCell) {
              const timeEl = dateCell.querySelector('time');
              date = timeEl ? getDirectText(timeEl) : getCleanText(dateCell);
            }

            // Look for description (usually in a cell with class containing "description" or "merchant")
            const descCell = row.querySelector('[class*="description"], [class*="merchant"], [class*="payee"]');
            description = descCell ? getCleanText(descCell) : (cells[1] ? getCleanText(cells[1]) : '');

            // Look for amount (cell with $ or number)
            const amountCell = row.querySelector('[class*="amount"]');
            if (amountCell) {
              amount = getCleanText(amountCell);
            }

            if (!amount) {
              // Search all cells for amount pattern
              for (const cell of cells) {
                const text = getCleanText(cell);
                if (text.match(/^-?\\$?[\\d,]+\\.\\d{2}$/)) {
                  amount = text;
                  break;
                }
              }
            }

            // Look for balance
            const balanceCell = row.querySelector('[class*="balance"]');
            if (balanceCell) {
              balance = getCleanText(balanceCell);
            }

            if (!balance) {
              // Check last few cells for balance
              for (let i = cells.length - 1; i >= Math.max(0, cells.length - 3); i--) {
                const text = getCleanText(cells[i]);
                if (text.match(/^\\$?[\\d,]+\\.\\d{2}$/) && text !== amount) {
                  balance = text;
                  break;
                }
              }
            }

            // Look for category
            const categoryCell = row.querySelector('[class*="category"]');
            category = categoryCell ? getCleanText(categoryCell) : '';

            return { date, description, amount, balance, category };
          }
        },

        // Strategy 2: Generic table rows with money amounts
        {
          name: 'generic-table',
          rowSelector: 'table tbody tr',
          extract: (row) => {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length < 3) return null;  // Transaction tables usually have at least 3 columns

            let date = '', description = '', amount = '', balance = '', category = '';

            // First cell is usually date
            date = getCleanText(cells[0]);

            // Skip if first cell doesn't look like a date
            if (!date.match(/\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4}|[A-Z][a-z]{2}\\s+\\d{1,2},?\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2}/)) {
              return null;  // Not a transaction row
            }

            // Find cells with dollar amounts (using cleaned text)
            const moneyCells = cells.filter(cell => {
              const text = getCleanText(cell);
              return text.match(/^-?\\$?[\\d,]+\\.\\d{2}$/);
            });

            // Skip if no money cells found
            if (moneyCells.length === 0) return null;

            // Second cell is usually description
            description = getCleanText(cells[1]);

            // Skip if description is too short or looks like a header
            if (description.length < 2 || description.match(/^(date|description|amount|balance|category)$/i)) {
              return null;
            }

            // Amount is usually the first money cell
            if (moneyCells[0]) {
              amount = getCleanText(moneyCells[0]);
            }

            // Balance is usually the second money cell
            if (moneyCells[1]) {
              balance = getCleanText(moneyCells[1]);
            }

            return { date, description, amount, balance, category };
          }
        }
      ];

      // Try each strategy
      for (const strategy of strategies) {
        console.log('[Scraper] Trying strategy:', strategy.name);
        const rows = document.querySelectorAll(strategy.rowSelector);
        console.log('[Scraper] Found', rows.length, 'rows with selector:', strategy.rowSelector);

        if (rows.length === 0) continue;

        let successCount = 0;
        let skippedCount = 0;
        for (const row of rows) {
          try {
            // Skip header rows (check if it's actually a header)
            const isHeaderRow = row.querySelector('th') !== null;
            if (isHeaderRow) {
              console.log('[Scraper] Skipping header row');
              continue;
            }

            const data = strategy.extract(row);

            // More lenient validation - require at least description or amount
            if (!data || (!data.date && !data.description && !data.amount)) {
              console.log('[Scraper] Skipping row - no data extracted');
              skippedCount++;
              continue;
            }

            // Require either date or amount (not both mandatory)
            if (!data.date && !data.amount) {
              console.log('[Scraper] Skipping row - missing both date and amount:', data);
              skippedCount++;
              continue;
            }

            // Skip pending transactions
            if (data.description.toLowerCase().includes('pending') ||
                data.category?.toLowerCase().includes('pending')) {
              console.log('[Scraper] Skipping pending transaction:', data.description);
              skippedCount++;
              continue;
            }

            // Log warnings for missing fields
            if (!data.date) {
              console.log('[Scraper] Warning: Transaction missing date:', data.description || '(no description)', data.amount || '(no amount)');
            }
            if (!data.amount) {
              console.log('[Scraper] Warning: Transaction missing amount:', data.description || '(no description)', data.date || '(no date)');
            }

            // Clean up description
            let cleanDesc = (data.description || '')
              .replace(/pending/gi, '')
              .replace(/posted/gi, '')
              .replace(/Opens? popup/gi, '')
              .replace(/\\s+/g, ' ')
              .trim();

            // Simplify description - take part before comma if present
            if (cleanDesc.includes(',')) {
              cleanDesc = cleanDesc.split(',')[0].trim();
            }

            // Clean amount (remove $ and commas, keep negative sign)
            let cleanAmount = (data.amount || '').replace(/[$,]/g, '').trim();

            // Clean balance
            let cleanBalance = data.balance.replace(/[$,]/g, '').trim();

            // Clean category - remove trailing numbers, extra spaces, special chars
            let category = data.category || '';
            if (category) {
              category = category
                .replace(/\\s+\\d+$/g, '')  // Remove trailing numbers like "Allowance 0"
                .replace(/[\\d\\(\\)]+$/g, '')  // Remove trailing numbers and parentheses
                .replace(/\\s+/g, ' ')  // Normalize spaces
                .trim();
            }

            // Infer category from description if not provided
            if (!category && cleanDesc) {
              const desc = cleanDesc.toLowerCase();
              if (desc.includes('restaurant') || desc.includes('shack') || desc.includes('cafe') || desc.includes('pizza')) {
                category = 'Restaurants & Dining';
              } else if (desc.includes('gas') || desc.includes('fuel') || desc.includes('shell') || desc.includes('chevron')) {
                category = 'Gas & Fuel';
              } else if (desc.includes('grocery') || desc.includes('market') || desc.includes('safeway') || desc.includes('whole foods')) {
                category = 'Groceries';
              } else if (desc.includes('amazon') || desc.includes('target') || desc.includes('walmart')) {
                category = 'Shopping';
              } else if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('hulu')) {
                category = 'Entertainment';
              }
            }

            // Only add if we have at least amount (date can be inferred later)
            if (cleanAmount || data.date) {
              transactions.push({
                date: data.date || '',  // Will be handled in Automation.tsx
                description: cleanDesc,
                amount: cleanAmount,
                balance: cleanBalance,
                category: category,
                index: transactions.length + 1,
                confidence: 95
              });

              successCount++;
            } else {
              console.log('[Scraper] Skipping row - no valid amount or date after cleaning:', cleanDesc);
              skippedCount++;
            }
          } catch (err) {
            console.warn('[Scraper] Failed to extract row:', err);
          }
        }

        console.log('[Scraper] Strategy', strategy.name, 'results: extracted', successCount, 'transactions, skipped', skippedCount, 'rows');

        // Continue trying all strategies instead of breaking after first success
        // This ensures we don't miss transactions that only one strategy can find
      }

      console.log('[Scraper] Before deduplication:', transactions.length, 'transactions');

      // Deduplicate transactions (same date, description, and amount)
      const uniqueTransactions = [];
      const seen = new Set();

      for (const txn of transactions) {
        const key = \`\${txn.date}|\${txn.description}|\${txn.amount}\`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueTransactions.push(txn);
        } else {
          console.log('[Scraper] Removing duplicate:', txn.description, txn.amount);
        }
      }

      console.log('[Scraper] After deduplication:', uniqueTransactions.length, 'unique transactions');

      // Limit to first 50 transactions (most recent on initial load)
      const LIMITED_COUNT = 50;
      if (uniqueTransactions.length > LIMITED_COUNT) {
        console.log('[Scraper] Limiting to first', LIMITED_COUNT, 'transactions');
        return uniqueTransactions.slice(0, LIMITED_COUNT);
      }

      return uniqueTransactions;
    })()
  `);

  console.log('[Scraper] Extraction complete! Found', scrapedTransactions?.length || 0, 'transactions');
  return scrapedTransactions || [];
}
