import type { ScrapedTransaction } from './types';

/**
 * Clean up scraped transactions using AI (Ollama)
 * - Normalizes category names (removes trailing numbers like "Television 0")
 * - Cleans up descriptions (removes bank jargon)
 * - Detects and removes duplicates
 * - Standardizes formatting
 */
export async function cleanTransactionsWithAI(
  transactions: ScrapedTransaction[],
  statusCallback?: (msg: string) => Promise<void>
): Promise<ScrapedTransaction[]> {
  console.log('[AI Cleanup] 🚀 Function called with', transactions.length, 'transactions');
  console.log('[AI Cleanup] First transaction:', JSON.stringify(transactions[0]));

  try {
    // Process in batches of 20 to avoid token limits
    const batchSize = 20;
    const cleanedTransactions: ScrapedTransaction[] = [];
    const totalBatches = Math.ceil(transactions.length / batchSize);
    console.log('[AI Cleanup] Will process', totalBatches, 'batches');

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      console.log(`[AI Cleanup] Processing batch ${batchNum} of ${totalBatches} (${batch.length} transactions)`);

      if (statusCallback) {
        await statusCallback(`AI cleanup (batch ${batchNum}/${totalBatches})...`);
      }

      const prompt = `You are a financial data cleanup assistant. Clean up these bank transactions by:

1. Normalize category names:
   - Remove trailing numbers like "Television 0" → "Television"
   - Remove extra spaces and special characters
   - Standardize common categories (e.g., "Fast Food", "Groceries", "Gas & Fuel", "Shopping", "Entertainment", "Bills & Utilities", "Income", "Transfer")
   - If category is empty or unclear, infer from description

2. Clean descriptions:
   - Remove bank jargon (DEBIT, ACH, POS, etc.)
   - Keep merchant names clear and simple
   - Remove extra whitespace

3. Remove duplicate transactions (same date, description, and amount)

4. Ensure all amounts are properly formatted numbers (negative for expenses, positive for income)

Input transactions (JSON):
${JSON.stringify(batch, null, 2)}

Return ONLY valid JSON array with cleaned transactions. Each transaction should have: date, description, amount, balance, category.
Example format:
[
  {
    "date": "2024-01-15",
    "description": "Amazon",
    "amount": "-45.99",
    "balance": "1250.00",
    "category": "Shopping"
  }
]`;

      // Try to find an available model (prefer llama3.2, fallback to any available)
      const modelToUse = await selectBestModel();
      console.log(`[AI Cleanup] Using model: ${modelToUse}`);

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToUse,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1, // Low temperature for more consistent output
            num_predict: 4000, // Allow longer responses for batch processing
          },
        }),
      });

      if (!response.ok) {
        console.error('[AI Cleanup] Ollama API error:', response.status);
        // Return original batch if AI fails
        cleanedTransactions.push(...batch);
        continue;
      }

      const data = await response.json();
      const aiResponse = data.response;

      // Extract JSON from AI response (it might include markdown code blocks)
      const cleanedBatch = parseAIResponse(aiResponse, batch, i);
      cleanedTransactions.push(...cleanedBatch);
    }

    console.log(`[AI Cleanup] Completed! Total transactions: ${cleanedTransactions.length}`);
    return cleanedTransactions;
  } catch (error) {
    console.error('[AI Cleanup] Error:', error);
    // Return original transactions if AI cleanup fails
    return transactions;
  }
}

/**
 * Select the best available Ollama model for transaction cleanup
 */
async function selectBestModel(): Promise<string> {
  const defaultModel = 'llama3.2';

  try {
    const modelsResponse = await fetch('http://localhost:11434/api/tags');
    if (!modelsResponse.ok) {
      return defaultModel;
    }

    const modelsData = await modelsResponse.json();
    const availableModels = modelsData.models?.map((m: any) => m.name) || [];

    // Prefer text models: llama3.2, mistral, or any other available
    const preferredModels = [
      'llama3.2',
      'llama3.2:latest',
      'mistral',
      'mistral:latest',
      'llama2',
      'llama2:latest',
    ];

    const foundModel = preferredModels.find((m) =>
      availableModels.some((a: string) => a.startsWith(m.split(':')[0]))
    );

    if (foundModel) {
      return foundModel;
    } else if (availableModels.length > 0) {
      // Use first available model
      return availableModels[0];
    }

    return defaultModel;
  } catch (error) {
    console.log('[AI Cleanup] Could not check models, using default:', defaultModel);
    return defaultModel;
  }
}

/**
 * Parse AI response and extract cleaned transactions
 */
function parseAIResponse(
  aiResponse: string,
  originalBatch: ScrapedTransaction[],
  batchStartIndex: number
): ScrapedTransaction[] {
  try {
    // Try to find JSON array in the response
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const cleanedBatch = JSON.parse(jsonMatch[0]) as ScrapedTransaction[];
      console.log(`[AI Cleanup] Successfully cleaned ${cleanedBatch.length} transactions in batch`);

      // Preserve the index from original
      cleanedBatch.forEach((txn, idx) => {
        txn.index = originalBatch[idx]?.index || batchStartIndex + idx + 1;
        txn.confidence = 98; // Higher confidence for AI-cleaned data
      });

      return cleanedBatch;
    } else {
      console.warn('[AI Cleanup] Could not extract JSON from AI response, using original batch');
      return originalBatch;
    }
  } catch (parseError) {
    console.error('[AI Cleanup] Failed to parse AI response:', parseError);
    console.log('[AI Cleanup] AI response was:', aiResponse.substring(0, 500));
    // Return original batch if parsing fails
    return originalBatch;
  }
}

/**
 * Check if Ollama is running and start it if needed
 */
export async function ensureOllamaRunning(): Promise<boolean> {
  // Check if Ollama is available
  let ollamaCheck = await fetch('http://localhost:11434/api/tags', {
    signal: AbortSignal.timeout(2000),
  }).catch(() => null);

  // If Ollama is not running, try to start it
  if (!ollamaCheck?.ok) {
    console.log('[Ollama] Not running, attempting to start...');

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Check if Ollama is installed
      await execAsync('which ollama');
      console.log('[Ollama] Installed, starting server...');

      // Start Ollama server in background
      exec('ollama serve > /dev/null 2>&1 &');

      // Wait for server to start (up to 5 seconds)
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        ollamaCheck = await fetch('http://localhost:11434/api/tags', {
          signal: AbortSignal.timeout(1000),
        }).catch(() => null);

        if (ollamaCheck?.ok) {
          console.log('[Ollama] ✓ Started successfully');
          return true;
        }
      }
    } catch (error) {
      console.log('[Ollama] Could not start:', error);
      return false;
    }
  }

  return ollamaCheck?.ok || false;
}
