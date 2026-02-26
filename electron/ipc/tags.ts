import { ipcMain, IpcMainInvokeEvent } from 'electron';
import * as tagQueries from '../db/queries/tags';
import { addLog } from './logs';
import { getDatabase } from '../db';
import { getAutomationSettings } from '../db/queries/automation-settings';

export const DEFAULT_AUTO_TAG_PROMPT =
`You are a financial transaction tagger for a personal finance app. Assign tags to bank transactions based on what they clearly represent.

RULES (follow strictly):
- Only tag a transaction if you are CERTAIN it matches (90%+ confidence)
- When in doubt, return an EMPTY tags array — a missed tag is far better than a wrong one
- Use each tag's description to understand exactly what it covers
- A transaction may match zero, one, or multiple tags
- Do not infer tags from vague similarities — require a clear, direct match

Available tags:
{{TAG_LIST}}

Transactions to classify (format — id: "description" type $amount [category]):
{{TX_LINES}}

Return a JSON array with one object per transaction:
  { "id": <number>, "tags": [<matched tag names>] }

If no tags match a transaction, return "tags": [].
Return ONLY the raw JSON array — no markdown, no explanation, no extra text.

JSON:`;

export function registerTagHandlers(): void {
  ipcMain.handle('tags:get-all', async () => {
    try {
      return tagQueries.getAllTags();
    } catch (error) {
      console.error('Error getting tags:', error);
      throw error;
    }
  });

  ipcMain.handle('tags:create', async (_: IpcMainInvokeEvent, data: { name: string; color: string; description?: string }) => {
    try {
      const id = tagQueries.createTag(data);
      addLog('success', 'Tags', `Created tag "${data.name}"${data.description ? ` — ${data.description}` : ''}`);
      return id;
    } catch (error) {
      addLog('error', 'Tags', `Failed to create tag "${data.name}": ${(error as Error).message}`);
      throw error;
    }
  });

  ipcMain.handle('tags:update', async (_: IpcMainInvokeEvent, data: { id: number; name?: string; color?: string; description?: string }) => {
    try {
      const tag = tagQueries.updateTag(data);
      addLog('info', 'Tags', `Updated tag "${tag.name}"`);
      return tag;
    } catch (error) {
      addLog('error', 'Tags', `Failed to update tag ${data.id}: ${(error as Error).message}`);
      throw error;
    }
  });

  ipcMain.handle('tags:get-monthly-stats', async (_: IpcMainInvokeEvent, months?: number) => {
    try {
      return tagQueries.getTagMonthlyStats(months ?? 6);
    } catch (error) {
      console.error('Error getting tag monthly stats:', error);
      throw error;
    }
  });

  ipcMain.handle('tags:delete', async (_: IpcMainInvokeEvent, id: number) => {
    try {
      const allTags = tagQueries.getAllTags();
      const tag = allTags.find(t => t.id === id);
      tagQueries.deleteTag(id);
      addLog('info', 'Tags', `Deleted tag "${tag?.name ?? id}"`);
    } catch (error) {
      addLog('error', 'Tags', `Failed to delete tag ${id}: ${(error as Error).message}`);
      throw error;
    }
  });

  ipcMain.handle('tags:get-for-transaction', async (_: IpcMainInvokeEvent, transactionId: number) => {
    try {
      return tagQueries.getTagsForTransaction(transactionId);
    } catch (error) {
      console.error('Error getting tags for transaction:', error);
      throw error;
    }
  });

  ipcMain.handle('tags:set-for-transaction', async (_: IpcMainInvokeEvent, transactionId: number, tagIds: number[]) => {
    try {
      tagQueries.setTagsForTransaction(transactionId, tagIds);
      if (tagIds.length > 0) {
        const allTags = tagQueries.getAllTags();
        const names = tagIds.map(id => allTags.find(t => t.id === id)?.name ?? id).join(', ');
        addLog('info', 'Tags', `Transaction ${transactionId} tagged: ${names}`);
      } else {
        addLog('info', 'Tags', `Cleared all tags from transaction ${transactionId}`);
      }
    } catch (error) {
      addLog('error', 'Tags', `Failed to set tags for transaction ${transactionId}: ${(error as Error).message}`);
      throw error;
    }
  });

  ipcMain.handle('tags:get-stats', async () => {
    try {
      return tagQueries.getTagStats();
    } catch (error) {
      console.error('Error getting tag stats:', error);
      throw error;
    }
  });

  ipcMain.handle('tags:get-transactions', async (_: IpcMainInvokeEvent, tagId: number) => {
    try {
      return tagQueries.getTransactionsForTag(tagId);
    } catch (error) {
      console.error('Error getting transactions for tag:', error);
      throw error;
    }
  });

  ipcMain.handle('tags:get-all-transaction-tags', async () => {
    try {
      return tagQueries.getAllTransactionTags();
    } catch (error) {
      console.error('Error getting all transaction tags:', error);
      throw error;
    }
  });

  ipcMain.handle('tags:auto-tag', async (event: IpcMainInvokeEvent) => {
    try {
      const allTags = tagQueries.getAllTags();
      if (allTags.length === 0) {
        addLog('warning', 'Tags', 'Auto-tag skipped — no tags defined');
        return { tagged: 0 };
      }

      const { getDatabase } = await import('../db/index');
      const db = getDatabase();
      const allTransactions = db.prepare(`
        SELECT tr.id, tr.description, tr.amount, c.name as category
        FROM transactions tr
        LEFT JOIN categories c ON c.id = tr.category_id
        WHERE tr.id NOT IN (SELECT DISTINCT transaction_id FROM transaction_tags)
        ORDER BY tr.date DESC
      `).all() as Array<{ id: number; description: string; amount: number; category: string | null }>;

      if (allTransactions.length === 0) {
        addLog('info', 'Tags', 'Auto-tag: no untagged transactions found');
        return { tagged: 0 };
      }

      const tagList = allTags
        .map(t => t.description ? `- "${t.name}": ${t.description}` : `- "${t.name}"`)
        .join('\n');
      const tagNameToId = new Map(allTags.map(t => [t.name.toLowerCase(), t.id]));

      // Load custom prompt from settings (fall back to built-in default)
      const db2 = getDatabase();
      const automationSettings = getAutomationSettings(db2);
      const promptTemplate = automationSettings.prompt_auto_tag || DEFAULT_AUTO_TAG_PROMPT;

      const batchSize = 5;
      let tagged = 0;
      const total = allTransactions.length;
      const totalBatches = Math.ceil(total / batchSize);

      addLog('info', 'Tags', `Auto-tag started — ${total} untagged transaction${total !== 1 ? 's' : ''}, ${allTags.length} tags available, ${totalBatches} batch${totalBatches !== 1 ? 'es' : ''}`);
      addLog('debug', 'Tags', `Tags: ${allTags.map(t => t.name).join(', ')}`);
      if (automationSettings.prompt_auto_tag) addLog('debug', 'Tags', 'Using custom auto-tag prompt from settings');

      for (let i = 0; i < allTransactions.length; i += batchSize) {
        const batch = allTransactions.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;

        addLog('debug', 'Tags', `Batch ${batchNum}/${totalBatches}: sending ${batch.length} transaction${batch.length !== 1 ? 's' : ''} to Ollama`);

        const txLines = batch
          .map(t => `${t.id}: "${t.description}" ${t.amount < 0 ? 'expense' : 'income'} $${Math.abs(t.amount).toFixed(2)}${t.category ? ` [${t.category}]` : ''}`)
          .join('\n');

        const prompt = promptTemplate
          .replace('{{TAG_LIST}}', tagList)
          .replace('{{TX_LINES}}', txLines);

        try {
          const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'llama3.2',
              prompt,
              stream: false,
              options: { temperature: 0.1, num_predict: 512 },
            }),
          });

          if (!response.ok) {
            addLog('error', 'Tags', `Batch ${batchNum}/${totalBatches}: Ollama HTTP error ${response.status}`);
            continue;
          }

          const data = await response.json() as { response: string };
          const text = (data.response || '').trim();

          addLog('debug', 'Tags', `Batch ${batchNum}/${totalBatches}: received response (${text.length} chars)`);

          // Try multiple extraction strategies for robustly getting the JSON array
          let results: Array<{ id: number; tags: string[] }> | null = null;

          // Strategy 1: whole response is valid JSON array
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) results = parsed;
          } catch { /* fall through */ }

          // Strategy 2: find the first [...] block (handles leading/trailing text)
          if (!results) {
            const start = text.indexOf('[');
            const end = text.lastIndexOf(']');
            if (start !== -1 && end > start) {
              try {
                const parsed = JSON.parse(text.slice(start, end + 1));
                if (Array.isArray(parsed)) results = parsed;
              } catch { /* fall through */ }
            }
          }

          if (!results) {
            addLog('warning', 'Tags', `Batch ${batchNum}/${totalBatches}: could not parse AI response — ${text.slice(0, 120)}`);
            continue;
          }

          let batchTagged = 0;
          for (const result of results) {
            if (!result || typeof result !== 'object') continue;
            const rawTags = result.tags;
            if (!Array.isArray(rawTags)) continue;

            const matchedTags = rawTags
              .filter((name): name is string => typeof name === 'string')
              .map(name => ({ name, id: tagNameToId.get(name.toLowerCase()) }))
              .filter((t): t is { name: string; id: number } => t.id !== undefined);

            if (matchedTags.length > 0) {
              tagQueries.setTagsForTransaction(result.id, matchedTags.map(t => t.id));
              const tx = batch.find(t => t.id === result.id);
              addLog('info', 'Tags', `Tagged "${tx?.description ?? result.id}" → ${matchedTags.map(t => t.name).join(', ')}`);
              tagged++;
              batchTagged++;
            }
          }

          addLog('debug', 'Tags', `Batch ${batchNum}/${totalBatches}: ${batchTagged}/${batch.length} transaction${batch.length !== 1 ? 's' : ''} tagged`);
        } catch (err) {
          addLog('error', 'Tags', `Batch ${batchNum}/${totalBatches}: request failed — ${(err as Error).message}`);
        }

        event.sender.send('tags:auto-tag-progress', { done: Math.min(i + batchSize, total), total });
      }

      addLog('success', 'Tags', `Auto-tag complete — ${tagged} of ${total} transaction${total !== 1 ? 's' : ''} tagged`);
      return { tagged };
    } catch (error) {
      addLog('error', 'Tags', `Auto-tag failed: ${(error as Error).message}`);
      throw error;
    }
  });

  console.log('Tag IPC handlers registered');
}
