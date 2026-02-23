import { ipcMain } from 'electron';
let mainWindow = null;
export function setMainWindow(window) {
    mainWindow = window;
}
export function registerHTMLScraperHandlers() {
    // Scrape transactions from HTML source
    ipcMain.handle('html-scraper:scrape', async (_, options) => {
        try {
            console.log('[HTML Scraper] Processing HTML...');
            console.log('[HTML Scraper] URL:', options.url);
            console.log('[HTML Scraper] HTML length:', options.html.length);
            const prompt = `You are a transaction extraction tool. Analyze this HTML source code from a bank website and extract ALL transactions.

HTML Source:
${options.html.substring(0, 50000)} // Limit to first 50k chars to avoid token limits

CRITICAL INSTRUCTIONS:
1. Extract EVERY transaction you can find in the HTML
2. Look for transaction data in tables, divs, lists, or any container elements
3. Your response must be ONLY a JSON array with no explanatory text

Output format (must be valid JSON array):
[
  {
    "date": "2024-01-15",
    "description": "Amazon Purchase",
    "amount": -45.99,
    "category": "Shopping"
  }
]

Extraction Rules:
- Use negative amounts for expenses/debits, positive for income/credits
- Parse dates to YYYY-MM-DD format (if year is missing, use 2024)
- Extract the merchant/description text
- Include category if present in the HTML
- Only transaction amounts, NOT running balances
- Extract ALL transactions found in the HTML
- Return empty array [] only if no transactions found
- Do NOT include markdown or explanatory text
- Start with [ and end with ]

Begin extracting ALL transactions now:`;
            // Call Ollama API (using text model, not vision)
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'llama3.2',
                    prompt: prompt,
                    stream: false,
                    options: {
                        num_predict: 8000,
                        temperature: 0.1,
                    },
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[HTML Scraper] Ollama API error:', response.status, errorText);
                return {
                    success: false,
                    error: `Ollama API error: ${response.status} - ${errorText}`,
                };
            }
            const data = await response.json();
            console.log('[HTML Scraper] Ollama responded');
            // Extract JSON from response
            let transactionsText = data.response;
            console.log('[HTML Scraper] Raw response preview:', transactionsText.substring(0, 200));
            // Parse the JSON
            const transactions = parseTransactionsJSON(transactionsText);
            if (!transactions) {
                return {
                    success: false,
                    error: 'Could not parse response as valid JSON',
                };
            }
            console.log('[HTML Scraper] Extracted', transactions.length, 'transactions');
            return {
                success: true,
                transactions,
                count: transactions.length,
            };
        }
        catch (error) {
            console.error('[HTML Scraper] Scrape failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
}
// JSON parsing with repair logic
function parseTransactionsJSON(text) {
    try {
        // Remove markdown code blocks
        let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        // Extract JSON array
        const jsonMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
            cleaned = jsonMatch[0];
        }
        // Repair incomplete JSON
        if (!cleaned.endsWith(']')) {
            const lastCompleteObject = cleaned.lastIndexOf('}');
            if (lastCompleteObject !== -1) {
                cleaned = cleaned.substring(0, lastCompleteObject + 1) + '\n]';
            }
        }
        // Remove trailing commas
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
        // Try to parse
        const transactions = JSON.parse(cleaned);
        if (Array.isArray(transactions)) {
            return transactions;
        }
        return null;
    }
    catch (error) {
        console.error('[HTML Scraper] JSON parse failed:', error);
        // Fallback: Extract individual transactions
        return extractCompleteTransactions(text);
    }
}
// Extract complete transaction objects from malformed JSON
function extractCompleteTransactions(jsonStr) {
    const transactions = [];
    const transactionRegex = /\{\s*"date"\s*:\s*"[^"]+"\s*,\s*"description"\s*:\s*"[^"]*"\s*,\s*"amount"\s*:\s*-?\d+\.?\d*(?:\s*,\s*"category"\s*:\s*(?:"[^"]*"|null))?\s*\}/g;
    const matches = jsonStr.matchAll(transactionRegex);
    for (const match of matches) {
        try {
            const txn = JSON.parse(match[0]);
            transactions.push(txn);
        }
        catch (e) {
            // Skip invalid
        }
    }
    return transactions;
}
