import type { BrowserWindow } from 'electron';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { ScrapedTransaction } from './types';

export interface VisionConfig {
  provider: 'claude' | 'ollama' | 'none';
  apiKey?: string;
  model?: string; // e.g., 'claude-3-5-sonnet-20241022', 'llama3.2-vision'
  maxTokens?: number;
  ollamaEndpoint?: string; // e.g., 'http://localhost:11434'
  customPrompt?: string; // Override default scraping prompt
}

export const DEFAULT_CLAUDE_PROMPT = `You are analyzing a bank transaction page screenshot. Extract ONLY the visible posted transactions from this single viewport.

WHAT TO LOOK FOR:
- Transaction tables or lists showing financial activity
- Columns typically include: Date, Description/Merchant, Amount, Balance, Category
- Look for dollar amounts (positive or negative)
- Look for dates in any format (Feb 04, 02/04/2024, etc.)
- Look for merchant names or transaction descriptions
- Look for category labels (Shopping, Groceries, Fast Food, Gas/Fuel, Auto & Transport, Bills & Utilities, etc.)

CRITICAL RULES:
1. Extract ONLY transactions visible in THIS screenshot (typically 10-50 recent transactions)
2. Include ALL transactions - both posted/cleared AND pending/processing transactions
3. For pending/processing transactions, ALWAYS use empty string "" for the category field
4. For posted/cleared transactions, extract the category if visible, otherwise use empty string ""
5. Clean merchant names (remove prefixes like "ACH", "DEBIT", "POS", "CARD PURCHASE", etc.)
6. Use negative amounts for expenses (money going out)
7. Use positive amounts for income (money coming in)
8. Parse dates in any format you see (Month DD, YYYY or MM/DD/YYYY, etc.)
9. If you see a balance column, include it

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
    "category": "Fast Food",
    "confidence": 95
  }
]

If the bank shows a category for the transaction, extract it exactly as shown. If no category is visible, use an empty string "".

Extract every visible transaction in the screenshot. Focus on the most recent transactions shown.`;

export const DEFAULT_OLLAMA_PROMPT = `You are analyzing a bank transaction page screenshot. Extract ONLY the visible posted transactions.

WHAT TO LOOK FOR:
- Transaction tables with Date, Description/Merchant, Amount, Balance, Category columns
- Dollar amounts (positive for income, negative for expenses)
- Dates in any format
- Merchant names or descriptions
- Category labels (Shopping, Groceries, Fast Food, Gas/Fuel, etc.)

CRITICAL RULES:
1. Extract ONLY visible transactions in THIS screenshot
2. Include ALL transactions - both posted/cleared AND pending/processing
3. For pending/processing transactions, ALWAYS use empty string "" for category
4. For posted/cleared transactions, extract category if visible, otherwise use empty string ""
5. Clean merchant names (remove prefixes like "ACH", "DEBIT", "POS")
6. Use negative amounts for expenses, positive for income

Return ONLY a JSON array with this structure (no markdown, no explanation):
[
  {
    "date": "Feb 04, 2026",
    "description": "Shake Shack",
    "amount": "-28.50",
    "balance": "2380.52",
    "category": "Fast Food",
    "confidence": 95
  }
]

If no transactions are found, return: []`;

/**
 * Scrape transactions using AI vision capabilities (Claude or Ollama)
 * This is more resilient to website changes than DOM parsing
 */
export async function scrapeWithVision(
  window: BrowserWindow,
  config: VisionConfig
): Promise<ScrapedTransaction[]> {
  console.log(`[Vision Scraper] Starting vision-based scraping with ${config.provider}...`);

  if (config.provider === 'claude') {
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
  } else if (config.provider === 'ollama') {
    // Step 1: Capture screenshots
    const screenshots = await captureFullPage(window);
    console.log(`[Vision Scraper] Captured ${screenshots.length} screenshot(s)`);

    // Step 2: Extract transactions using Ollama
    const transactions = await extractTransactionsWithOllama(screenshots, config);
    console.log(`[Vision Scraper] Extracted ${transactions.length} transactions`);

    return transactions;
  } else {
    throw new Error(`Unsupported vision provider: ${config.provider}`);
  }
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

  // Construct the prompt (use custom prompt if provided, otherwise use default)
  const prompt = config.customPrompt || DEFAULT_CLAUDE_PROMPT;

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
 * Extract transactions from screenshots using Ollama API
 */
async function extractTransactionsWithOllama(
  screenshots: Buffer[],
  config: VisionConfig
): Promise<ScrapedTransaction[]> {
  const endpoint = config.ollamaEndpoint || 'http://localhost:11434';
  const model = config.model || 'llama3.2-vision';

  console.log(`[Vision Scraper] Using Ollama endpoint: ${endpoint}`);
  console.log(`[Vision Scraper] Using model: ${model}`);

  // Ollama vision API expects base64 encoded images
  const imageData = screenshots[0].toString('base64'); // Use first screenshot for now

  // Construct the prompt (use custom prompt if provided, otherwise use default)
  const prompt = config.customPrompt || DEFAULT_OLLAMA_PROMPT;

  console.log('[Vision Scraper] Sending request to Ollama API...');

  try {
    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        images: [imageData],
        stream: false,
        format: 'json',
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[Vision Scraper] Received response from Ollama API');

    if (!data.response) {
      throw new Error('No response field in Ollama response');
    }

    const responseText = data.response.trim();
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
      throw new Error(`Failed to parse Ollama response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    if (!Array.isArray(transactions)) {
      throw new Error('Ollama response is not an array');
    }

    if (transactions.length === 0) {
      console.warn('[Vision Scraper] ⚠️ Ollama returned 0 transactions');
      console.warn('[Vision Scraper] This could mean the page has no visible transactions or the model needs fine-tuning');
    }

    // Validate and normalize transactions (same as Claude)
    const scrapedTransactions: ScrapedTransaction[] = transactions.map((txn, index) => {
      if (!txn.description && !txn.amount) {
        console.warn('[Vision Scraper] Skipping invalid transaction:', txn);
        return null;
      }

      let description = (txn.description || '').trim();
      if (description.includes(',')) {
        description = description.split(',')[0].trim();
      }

      const amount = (txn.amount || '').toString().replace(/[$,]/g, '').trim();
      const balance = txn.balance ? txn.balance.toString().replace(/[$,]/g, '').trim() : '';
      const category = txn.category ? txn.category.toString().trim() : '';

      return {
        date: txn.date || '',
        description,
        amount,
        balance,
        category,
        index: index + 1,
        confidence: txn.confidence || 85, // Slightly lower confidence for Ollama
      };
    }).filter((txn): txn is ScrapedTransaction => txn !== null);

    console.log('[Vision Scraper] Successfully extracted', scrapedTransactions.length, 'transactions');
    return scrapedTransactions;

  } catch (error) {
    console.error('[Vision Scraper] Error calling Ollama API:', error);

    if (error instanceof Error) {
      // Check if it's a connection error
      if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
        throw new Error('Failed to connect to Ollama. Make sure Ollama is running and accessible at ' + endpoint);
      }
    }

    throw error;
  }
}

/**
 * Handle pagination if the bank shows transactions across multiple pages
 * This is a placeholder for future enhancement
 */
export async function handlePagination(window: BrowserWindow): Promise<boolean> {
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
