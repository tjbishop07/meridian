import { ipcMain, IpcMainInvokeEvent } from 'electron';
import * as tagQueries from '../db/queries/tags';

export function registerTagHandlers(): void {
  ipcMain.handle('tags:get-all', async () => {
    try {
      return tagQueries.getAllTags();
    } catch (error) {
      console.error('Error getting tags:', error);
      throw error;
    }
  });

  ipcMain.handle('tags:create', async (_: IpcMainInvokeEvent, data: { name: string; color: string }) => {
    try {
      return tagQueries.createTag(data);
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  });

  ipcMain.handle('tags:update', async (_: IpcMainInvokeEvent, data: { id: number; name?: string; color?: string }) => {
    try {
      return tagQueries.updateTag(data);
    } catch (error) {
      console.error('Error updating tag:', error);
      throw error;
    }
  });

  ipcMain.handle('tags:delete', async (_: IpcMainInvokeEvent, id: number) => {
    try {
      tagQueries.deleteTag(id);
    } catch (error) {
      console.error('Error deleting tag:', error);
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
    } catch (error) {
      console.error('Error setting tags for transaction:', error);
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
      if (allTags.length === 0) return { tagged: 0 };

      const { getDatabase } = await import('../db/index');
      const db = getDatabase();
      const allTransactions = db.prepare(`
        SELECT tr.id, tr.description, tr.amount, c.name as category
        FROM transactions tr
        LEFT JOIN categories c ON c.id = tr.category_id
        WHERE tr.id NOT IN (SELECT DISTINCT transaction_id FROM transaction_tags)
        ORDER BY tr.date DESC
      `).all() as Array<{ id: number; description: string; amount: number; category: string | null }>;

      if (allTransactions.length === 0) return { tagged: 0 };

      const tagNames = allTags.map(t => t.name).join(', ');
      const tagNameToId = new Map(allTags.map(t => [t.name.toLowerCase(), t.id]));

      // Smaller batches produce cleaner, shorter responses that are less likely to be truncated
      const batchSize = 5;
      let tagged = 0;
      const total = allTransactions.length;

      for (let i = 0; i < allTransactions.length; i += batchSize) {
        const batch = allTransactions.slice(i, i + batchSize);

        const txLines = batch
          .map(t => `${t.id}: "${t.description}" ${t.amount < 0 ? 'expense' : 'income'} $${Math.abs(t.amount).toFixed(2)}${t.category ? ` [${t.category}]` : ''}`)
          .join('\n');

        const prompt = `Tag these transactions. Available tags: ${tagNames}

For each transaction return a JSON object with "id" and "tags" (array of matching tag names, empty if none fit).
Return ONLY a valid JSON array. No markdown, no explanation, no trailing text.

${txLines}

JSON:`;

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
            console.error('[tags:auto-tag] HTTP error:', response.status);
            continue;
          }

          const data = await response.json() as { response: string };
          const text = (data.response || '').trim();

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
            console.warn('[tags:auto-tag] Could not extract JSON from response:', text.slice(0, 200));
            continue;
          }

          for (const result of results) {
            if (!result || typeof result !== 'object') continue;
            const rawTags = result.tags;
            if (!Array.isArray(rawTags)) continue;

            const tagIds = rawTags
              .filter((name): name is string => typeof name === 'string')
              .map(name => tagNameToId.get(name.toLowerCase()))
              .filter((id): id is number => id !== undefined);

            if (tagIds.length > 0) {
              tagQueries.setTagsForTransaction(result.id, tagIds);
              tagged++;
            }
          }
        } catch (err) {
          console.error('[tags:auto-tag] Batch error:', err);
        }

        event.sender.send('tags:auto-tag-progress', { done: Math.min(i + batchSize, total), total });
      }

      return { tagged };
    } catch (error) {
      console.error('Error in auto-tag:', error);
      throw error;
    }
  });

  console.log('Tag IPC handlers registered');
}
