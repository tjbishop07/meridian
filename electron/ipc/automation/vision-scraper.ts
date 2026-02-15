import type { BrowserWindow } from 'electron';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { ScrapedTransaction } from './types';

export interface VisionConfig {
  provider: 'claude' | 'none';
  apiKey?: string;
  model?: string; // e.g., 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'
  maxTokens?: number;
}

/**
 * Scrape transactions using Claude's vision capabilities
 * This is more resilient to website changes than DOM parsing
 */
export async function scrapeWithVision(
  window: BrowserWindow,
  config: VisionConfig
): Promise<ScrapedTransaction[]> {
  console.log('[Vision Scraper] Starting vision-based scraping...');

  if (config.provider !== 'claude') {
    throw new Error(`Unsupported vision provider: ${config.provider}`);
  }

  if (!config.apiKey) {
    throw new Error('Claude API key is required for vision scraping');
  }

  // Step 1: Capture screenshots
  const screenshots = await captureFullPage(window);
  console.log(`[Vision Scraper] Captured ${screenshots.length} screenshot(s)`);

  // Step 2: Extract transactions using Claude
  const transactions = await extractTransactionsWithClaude(screenshots, config);
  console.log(`[Vision Scraper] Extracted ${transactions.length} transactions`);

  return transactions;
}

/**
 * Capture full page screenshots (handles scrolling for long pages)
 */
async function captureFullPage(window: BrowserWindow): Promise<Buffer[]> {
  const screenshots: Buffer[] = [];

  // Get page dimensions
  const dimensions = await window.webContents.executeJavaScript(`
    ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    })
  `);

  console.log('[Vision Scraper] Page dimensions:', dimensions);

  // Capture overlapping screenshots to ensure we don't miss any transactions
  console.log('[Vision Scraper] Capturing comprehensive screenshots with overlap...');

  const viewportHeight = dimensions.clientHeight;
  const totalHeight = dimensions.scrollHeight;
  const isScrollable = totalHeight > viewportHeight * 1.2;

  if (isScrollable) {
    // Scroll in overlapping chunks (60% of viewport at a time = 40% overlap)
    const scrollStep = Math.floor(viewportHeight * 0.6); // 60% viewport height
    const numScreenshots = Math.min(
      Math.ceil((totalHeight - viewportHeight) / scrollStep) + 1,
      6 // Cap at 6 screenshots to avoid too many API calls
    );

    console.log(`[Vision Scraper] Page height: ${totalHeight}px, viewport: ${viewportHeight}px`);
    console.log(`[Vision Scraper] Will capture ${numScreenshots} overlapping screenshots`);

    for (let i = 0; i < numScreenshots; i++) {
      // Calculate scroll position with overlap
      const scrollY = Math.min(i * scrollStep, totalHeight - viewportHeight);

      await window.webContents.executeJavaScript(`window.scrollTo(0, ${scrollY})`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for rendering

      const screenshot = await window.webContents.capturePage();
      screenshots.push(screenshot.toPNG());

      const percentComplete = Math.round((scrollY / (totalHeight - viewportHeight)) * 100);
      console.log(`[Vision Scraper] Screenshot ${i + 1}/${numScreenshots} at ${scrollY}px (${percentComplete}%)`);

      // Stop if we've reached the bottom
      if (scrollY >= totalHeight - viewportHeight - 10) {
        console.log('[Vision Scraper] Reached bottom of page');
        break;
      }
    }

    // Scroll back to top
    await window.webContents.executeJavaScript('window.scrollTo(0, 0)');
    await new Promise(resolve => setTimeout(resolve, 300));

    console.log(`[Vision Scraper] Captured ${screenshots.length} screenshots total`);
  } else {
    // Single screenshot for non-scrollable pages
    console.log('[Vision Scraper] Page fits in viewport, capturing single screenshot');
    await window.webContents.executeJavaScript('window.scrollTo(0, 0)');
    await new Promise(resolve => setTimeout(resolve, 300));

    const screenshot = await window.webContents.capturePage();
    screenshots.push(screenshot.toPNG());
  }

  return screenshots;
}

/**
 * Extract transactions from screenshots using Claude API
 */
async function extractTransactionsWithClaude(
  screenshots: Buffer[],
  config: VisionConfig
): Promise<ScrapedTransaction[]> {
  const client = new Anthropic({
    apiKey: config.apiKey,
  });

  const model = config.model || 'claude-sonnet-4-5-20250929'; // Default to Claude Sonnet 4.5 (latest)
  const maxTokens = config.maxTokens || 4096;

  // Prepare image data for Claude API
  const imageContent = screenshots.map((screenshot) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/png' as const,
      data: screenshot.toString('base64'),
    },
  }));

  // Construct the prompt
  const prompt = `You are analyzing a bank transaction page screenshot. Extract ONLY the visible posted transactions from this single viewport.

WHAT TO LOOK FOR:
- Transaction tables or lists showing financial activity
- Columns typically include: Date, Description/Merchant, Amount, Balance
- Look for dollar amounts (positive or negative)
- Look for dates in any format (Feb 04, 02/04/2024, etc.)
- Look for merchant names or transaction descriptions

CRITICAL RULES:
1. Extract ONLY transactions visible in THIS screenshot (typically 10-50 recent transactions)
2. Skip any transactions marked as "pending" or "processing"
3. Only include transactions that have been posted/cleared
4. Clean merchant names (remove prefixes like "ACH", "DEBIT", "POS", "CARD PURCHASE", etc.)
5. Use negative amounts for expenses (money going out)
6. Use positive amounts for income (money coming in)
7. Parse dates in any format you see (Month DD, YYYY or MM/DD/YYYY, etc.)
8. If you see a balance column, include it
9. Do NOT include category - leave it empty (categories will be assigned later)

IMPORTANT: If you cannot find ANY transaction data in the image:
- Return an empty array: []
- The page might be a login screen, loading screen, or error page
- The page might not have finished loading transaction data yet

Return ONLY a JSON array with this exact structure (no markdown, no explanation):
[
  {
    "date": "Feb 04, 2026",
    "description": "Shake Shack",
    "amount": "-28.50",
    "balance": "2380.52",
    "category": "",
    "confidence": 95
  }
]

Extract every visible transaction in the screenshot. Focus on the most recent transactions shown.`;

  console.log('[Vision Scraper] Sending request to Claude API...');

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    console.log('[Vision Scraper] Received response from Claude API');

    // Extract text from response
    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    const responseText = textBlock.text.trim();
    console.log('[Vision Scraper] Response text length:', responseText.length);
    console.log('[Vision Scraper] Response preview:', responseText.substring(0, 200));

    // Parse JSON response
    let transactions: any[];
    try {
      // Handle potential markdown code blocks
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                       responseText.match(/```\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : responseText;

      transactions = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[Vision Scraper] Failed to parse JSON:', responseText.substring(0, 500));
      throw new Error(`Failed to parse Claude response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    if (!Array.isArray(transactions)) {
      throw new Error('Claude response is not an array');
    }

    // If Claude returned empty array, check if it gave a reason
    if (transactions.length === 0) {
      console.warn('[Vision Scraper] ⚠️ Claude returned 0 transactions');
      console.warn('[Vision Scraper] This could mean:');
      console.warn('[Vision Scraper]   1. The page has no transactions visible');
      console.warn('[Vision Scraper]   2. All transactions are pending (and were skipped)');
      console.warn('[Vision Scraper]   3. The screenshot quality is poor');
      console.warn('[Vision Scraper]   4. The page layout is not recognized');
      console.warn('[Vision Scraper] Consider waiting longer before scraping or checking the page URL');

      // Save screenshot for debugging
      try {
        const debugDir = path.join(app.getPath('userData'), 'debug-screenshots');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const debugPath = path.join(debugDir, `empty-result-${timestamp}.png`);
        fs.writeFileSync(debugPath, screenshots[0]);
        console.warn(`[Vision Scraper] 📸 Screenshot saved for debugging: ${debugPath}`);
      } catch (err) {
        console.error('[Vision Scraper] Failed to save debug screenshot:', err);
      }
    }

    // Validate and normalize transactions
    const scrapedTransactions: ScrapedTransaction[] = transactions.map((txn, index) => {
      // Validate required fields
      if (!txn.description && !txn.amount) {
        console.warn('[Vision Scraper] Skipping invalid transaction:', txn);
        return null;
      }

      // Clean description
      let description = (txn.description || '').trim();
      if (description.includes(',')) {
        description = description.split(',')[0].trim();
      }

      // Clean amount (remove $ and commas, keep negative sign)
      const amount = (txn.amount || '').toString().replace(/[$,]/g, '').trim();

      // Clean balance
      const balance = txn.balance ? txn.balance.toString().replace(/[$,]/g, '').trim() : '';

      // Clean category
      const category = txn.category ? txn.category.toString().trim() : '';

      return {
        date: txn.date || '',
        description,
        amount,
        balance,
        category,
        index: index + 1,
        confidence: txn.confidence || 90,
      };
    }).filter((txn): txn is ScrapedTransaction => txn !== null);

    console.log('[Vision Scraper] Successfully extracted', scrapedTransactions.length, 'transactions');
    return scrapedTransactions;

  } catch (error) {
    console.error('[Vision Scraper] Error calling Claude API:', error);

    if (error instanceof Anthropic.APIError) {
      throw new Error(`Claude API error: ${error.message} (status: ${error.status})`);
    }

    throw error;
  }
}

/**
 * Handle pagination if the bank shows transactions across multiple pages
 * This is a placeholder for future enhancement
 */
async function handlePagination(window: BrowserWindow): Promise<boolean> {
  // Check if there's a "Next" or "Load More" button
  const hasNextPage = await window.webContents.executeJavaScript(`
    (function() {
      // Look for common pagination elements
      const nextButtons = [
        ...document.querySelectorAll('button, a'),
      ].filter(el => {
        const text = el.textContent?.toLowerCase() || '';
        return text.includes('next') ||
               text.includes('load more') ||
               text.includes('show more');
      });

      return nextButtons.length > 0;
    })()
  `);

  return hasNextPage;
}
