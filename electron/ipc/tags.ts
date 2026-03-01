import { ipcMain, IpcMainInvokeEvent } from 'electron';
import * as tagQueries from '../db/queries/tags';
import * as tagRuleQueries from '../db/queries/tag-rules';
import * as tagCorrectionQueries from '../db/queries/tag-corrections';
import type { TagRule } from '../db/queries/tag-rules';
import { addLog } from './logs';
import { getAutomationSettings } from '../db/queries/automation-settings';
import { getDatabase } from '../db/index';

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

/**
 * Parse the raw text response from Ollama into a tag-assignment array.
 * Handles three formats models may return:
 *   1. JSON array  — [{id, tags}, ...]
 *   2. Array embedded in prose — "Here you go: [{id, tags}, ...]"
 *   3. Object keyed by ID — {"8758": {"tags": [...]}, ...}
 */
export function parseAutoTagResponse(text: string): Array<{ id: number; tags: string[] }> | null {
  // Strategy 1: whole response is a valid JSON array
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* fall through */ }

  // Strategy 2: find the first [...] block (handles leading/trailing prose)
  // Only accept arrays of objects to avoid matching nested string arrays like ["Food"]
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'object' && item !== null)) return parsed;
    } catch { /* fall through */ }
  }

  // Strategy 3: object keyed by transaction ID e.g. {"8758": {"tags": [...]}, ...}
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const arr = Object.entries(parsed).map(([key, val]: [string, any]) => ({
        id: Number(key),
        tags: Array.isArray((val as any)?.tags) ? (val as any).tags : [],
      }));
      if (arr.length > 0) return arr;
    }
  } catch { /* fall through */ }

  return null;
}

/**
 * Filter auto-tag results against exclusion rules.
 * Mutates `results` in-place by removing blocked tag names.
 */
export function applyTagRules(
  results: Array<{ id: number; tags: string[] }>,
  batch: Array<{ id: number; description: string }>,
  tagRules: TagRule[],
  tagNameToId: Map<string, number>,
): void {
  if (tagRules.length === 0) return;
  for (const result of results) {
    const tx = batch.find(t => t.id === result.id);
    const descLower = tx?.description.toLowerCase() ?? '';
    result.tags = result.tags.filter(tagName => {
      const tagId = tagNameToId.get(tagName.toLowerCase());
      const blocked = tagRules.some(r =>
        r.action === 'exclude' && r.tag_id === tagId &&
        descLower.includes(r.pattern.toLowerCase())
      );
      if (blocked) addLog('info', 'Tags', `Rule blocked "${tagName}" on "${tx?.description}"`);
      return !blocked;
    });
  }
}

/**
 * Apply inclusion rules to untagged transactions.
 * Returns a map of txId → tagIds for transactions that should be pre-tagged before the AI batch.
 */
export function applyInclusionRules(
  transactions: Array<{ id: number; description: string }>,
  inclusionRules: TagRule[],
): Map<number, number[]> {
  const preTagged = new Map<number, number[]>();
  if (inclusionRules.length === 0) return preTagged;

  for (const tx of transactions) {
    const descLower = tx.description.toLowerCase();
    const matchingTagIds = new Set<number>();
    for (const rule of inclusionRules) {
      if (descLower.includes(rule.pattern.toLowerCase())) {
        matchingTagIds.add(rule.tag_id);
      }
    }
    if (matchingTagIds.size > 0) {
      preTagged.set(tx.id, [...matchingTagIds]);
    }
  }

  return preTagged;
}

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

  ipcMain.handle('tags:clear-all-assignments', async () => {
    try {
      const count = tagQueries.clearAllTagAssignments();
      addLog('info', 'Tags', `Cleared all tag assignments — ${count} removed`);
      return { count };
    } catch (error) {
      addLog('error', 'Tags', `Failed to clear all tag assignments: ${(error as Error).message}`);
      throw error;
    }
  });

  ipcMain.handle('tags:auto-tag', async (event: IpcMainInvokeEvent, options?: { daysBack?: number }) => {
    try {
      const allTags = tagQueries.getAllTags();
      if (allTags.length === 0) {
        addLog('warning', 'Tags', 'Auto-tag skipped — no tags defined');
        return { tagged: 0 };
      }

      const { getDatabase } = await import('../db/index');
      const db = getDatabase();
      const daysBack = options?.daysBack ?? 0;
      const dateClause = daysBack > 0
        ? `AND tr.date >= date('now', '-${daysBack} days')`
        : '';
      const allTransactions = db.prepare(`
        SELECT tr.id, tr.description, tr.amount, c.name as category
        FROM transactions tr
        LEFT JOIN categories c ON c.id = tr.category_id
        WHERE tr.id NOT IN (SELECT DISTINCT transaction_id FROM transaction_tags)
        ${dateClause}
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
      const ollamaModel = automationSettings.auto_tag_model || 'llama3.2';

      // Load all rule types and training examples
      const allTagRules = tagRuleQueries.getAllTagRules();
      const inclusionRules = allTagRules.filter(r => r.action === 'include');
      const exclusionRules = allTagRules.filter(r => r.action === 'exclude');
      const corrections = tagCorrectionQueries.getAllTagCorrections();

      const total = allTransactions.length;
      addLog('info', 'Tags', `Auto-tag started — ${total} untagged transaction${total !== 1 ? 's' : ''}, ${allTags.length} tags available (model: ${ollamaModel})`);
      addLog('debug', 'Tags', `Tags: ${allTags.map(t => t.name).join(', ')}`);
      if (automationSettings.prompt_auto_tag) addLog('debug', 'Tags', 'Using custom auto-tag prompt from settings');
      if (inclusionRules.length > 0) addLog('debug', 'Tags', `Inclusion rules: ${inclusionRules.length}, exclusion rules: ${exclusionRules.length}, training examples: ${corrections.length}`);

      // ── Step 1: Apply inclusion rules (deterministic pre-tagging before AI) ──
      let inclusionTagged = 0;
      const preTaggedIds = new Set<number>();

      if (inclusionRules.length > 0) {
        const preTaggedMap = applyInclusionRules(allTransactions, inclusionRules);
        for (const [txId, tagIds] of preTaggedMap) {
          tagQueries.setTagsForTransaction(txId, tagIds);
          const tx = allTransactions.find(t => t.id === txId);
          const tagNames = tagIds.map(id => allTags.find(t => t.id === id)?.name ?? id).join(', ');
          addLog('info', 'Tags', `Inclusion rule: tagged "${tx?.description}" → ${tagNames}`);
          preTaggedIds.add(txId);
          inclusionTagged++;
        }
        if (inclusionTagged > 0) {
          addLog('info', 'Tags', `Inclusion rules pre-tagged ${inclusionTagged} transaction${inclusionTagged !== 1 ? 's' : ''}`);
          event.sender.send('tags:auto-tag-progress', { done: inclusionTagged, total });
        }
      }

      // ── Step 2: Build prompt additions (built once, applied to every batch) ──
      let fewShotSection = '';
      if (corrections.length > 0) {
        const lines: string[] = [];
        for (const ex of corrections.slice(0, 20)) {
          if (ex.direction === 'positive') {
            lines.push(`- "${ex.description}" SHOULD be tagged as "${ex.tag_name}"`);
          } else {
            lines.push(`- "${ex.description}" should NOT be tagged as "${ex.tag_name}"`);
          }
        }
        if (lines.length > 0) {
          fewShotSection = `\n\nEXAMPLES FROM YOUR CORRECTIONS (use these to calibrate accuracy):\n${lines.join('\n')}`;
        }
      }

      let rulesSection = '';
      if (exclusionRules.length > 0) {
        const lines = exclusionRules.map(r => `- Never tag descriptions containing "${r.pattern}" with "${r.tag_name}"`).join('\n');
        rulesSection = `\n\nCORRECTION RULES (always override your judgment):\n${lines}`;
      }

      // ── Step 3: Send remaining transactions to AI ──
      const aiTransactions = allTransactions.filter(t => !preTaggedIds.has(t.id));

      if (aiTransactions.length === 0) {
        addLog('success', 'Tags', `Auto-tag complete — ${inclusionTagged} of ${total} transaction${total !== 1 ? 's' : ''} tagged (all by inclusion rules)`);
        return { tagged: inclusionTagged };
      }

      const batchSize = 5;
      let aiTagged = 0;
      const aiTotal = aiTransactions.length;
      const totalBatches = Math.ceil(aiTotal / batchSize);

      addLog('debug', 'Tags', `Sending ${aiTotal} transaction${aiTotal !== 1 ? 's' : ''} to AI in ${totalBatches} batch${totalBatches !== 1 ? 'es' : ''}`);

      for (let i = 0; i < aiTransactions.length; i += batchSize) {
        const batch = aiTransactions.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;

        addLog('debug', 'Tags', `Batch ${batchNum}/${totalBatches}: sending ${batch.length} transaction${batch.length !== 1 ? 's' : ''} to Ollama`);

        const txLines = batch
          .map(t => `${t.id}: "${t.description}" ${t.amount < 0 ? 'expense' : 'income'} $${Math.abs(t.amount).toFixed(2)}${t.category ? ` [${t.category}]` : ''}`)
          .join('\n');

        const prompt = promptTemplate
          .replace('{{TAG_LIST}}', tagList)
          .replace('{{TX_LINES}}', txLines) + fewShotSection + rulesSection;

        try {
          const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: ollamaModel,
              prompt,
              format: 'json',
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

          const results = parseAutoTagResponse(text);

          if (!results) {
            addLog('warning', 'Tags', `Batch ${batchNum}/${totalBatches}: could not parse AI response — ${text.slice(0, 120)}`);
            continue;
          }

          applyTagRules(results, batch, exclusionRules, tagNameToId);

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
              addLog('info', 'Tags', `AI tagged "${tx?.description ?? result.id}" → ${matchedTags.map(t => t.name).join(', ')}`);
              aiTagged++;
              batchTagged++;
            }
          }

          addLog('debug', 'Tags', `Batch ${batchNum}/${totalBatches}: ${batchTagged}/${batch.length} transaction${batch.length !== 1 ? 's' : ''} tagged`);
        } catch (err) {
          addLog('error', 'Tags', `Batch ${batchNum}/${totalBatches}: request failed — ${(err as Error).message}`);
        }

        event.sender.send('tags:auto-tag-progress', { done: inclusionTagged + Math.min(i + batchSize, aiTotal), total });
      }

      const totalTagged = inclusionTagged + aiTagged;
      addLog('success', 'Tags', `Auto-tag complete — ${totalTagged} of ${total} transaction${total !== 1 ? 's' : ''} tagged (${inclusionTagged} by rules, ${aiTagged} by AI)`);
      return { tagged: totalTagged };
    } catch (error) {
      addLog('error', 'Tags', `Auto-tag failed: ${(error as Error).message}`);
      throw error;
    }
  });

  ipcMain.handle('tag-rules:get-all', async () => {
    try {
      return tagRuleQueries.getAllTagRules();
    } catch (error) {
      console.error('Error getting tag rules:', error);
      throw error;
    }
  });

  ipcMain.handle('tag-rules:create', async (_: IpcMainInvokeEvent, data: { tag_id: number; pattern: string; action?: 'exclude' | 'include' }) => {
    try {
      const id = tagRuleQueries.createTagRule({ tag_id: data.tag_id, pattern: data.pattern, action: data.action });
      const rule = tagRuleQueries.getAllTagRules().find(r => r.id === id);
      const actionWord = (data.action ?? 'exclude') === 'include' ? 'always' : 'never';
      addLog('info', 'Tags', `Created rule: ${actionWord} tag "${rule?.tag_name ?? data.tag_id}" when description contains "${data.pattern}"`);
      return rule;
    } catch (error) {
      addLog('error', 'Tags', `Failed to create tag rule: ${(error as Error).message}`);
      throw error;
    }
  });

  ipcMain.handle('tag-rules:delete', async (_: IpcMainInvokeEvent, id: number) => {
    try {
      tagRuleQueries.deleteTagRule(id);
      addLog('info', 'Tags', `Deleted tag rule ${id}`);
    } catch (error) {
      addLog('error', 'Tags', `Failed to delete tag rule ${id}: ${(error as Error).message}`);
      throw error;
    }
  });

  ipcMain.handle('tag-rules:apply', async (_: IpcMainInvokeEvent, ruleId: number, daysBack?: number) => {
    try {
      const db = getDatabase();
      const rule = db.prepare(
        'SELECT tr.*, t.name as tag_name FROM tag_rules tr JOIN tags t ON t.id = tr.tag_id WHERE tr.id = ?'
      ).get(ruleId) as (typeof tagRuleQueries.getAllTagRules extends () => (infer R)[] ? R : never) | undefined;
      if (!rule) throw new Error(`Rule ${ruleId} not found`);

      const safeDaysBack = typeof daysBack === 'number' && daysBack > 0 ? Math.floor(daysBack) : 0;
      const dateClause = safeDaysBack > 0 ? `AND date >= date('now', '-${safeDaysBack} days')` : '';

      let count = 0;

      if (rule.action === 'include') {
        const txs = db.prepare(
          `SELECT id FROM transactions WHERE LOWER(description) LIKE LOWER(?) ${dateClause}`
        ).all(`%${rule.pattern}%`) as Array<{ id: number }>;

        for (const tx of txs) {
          const currentTagIds = (db.prepare(
            'SELECT tag_id FROM transaction_tags WHERE transaction_id = ?'
          ).all(tx.id) as Array<{ tag_id: number }>).map((r) => r.tag_id);
          if (!currentTagIds.includes(rule.tag_id)) {
            tagQueries.setTagsForTransaction(tx.id, [...currentTagIds, rule.tag_id]);
            count++;
          }
        }
      } else {
        const txs = db.prepare(
          `SELECT tt.transaction_id as id
           FROM transaction_tags tt
           JOIN transactions tr ON tr.id = tt.transaction_id
           WHERE tt.tag_id = ? AND LOWER(tr.description) LIKE LOWER(?)
           ${dateClause}`
        ).all(rule.tag_id, `%${rule.pattern}%`) as Array<{ id: number }>;

        for (const tx of txs) {
          const currentTagIds = (db.prepare(
            'SELECT tag_id FROM transaction_tags WHERE transaction_id = ?'
          ).all(tx.id) as Array<{ tag_id: number }>).map((r) => r.tag_id).filter((id) => id !== rule.tag_id);
          tagQueries.setTagsForTransaction(tx.id, currentTagIds);
          count++;
        }
      }

      addLog('info', 'Tags', `Applied rule "${rule.tag_name} / ${rule.pattern}" — ${count} transaction(s) updated`);
      return { count };
    } catch (error) {
      addLog('error', 'Tags', `Failed to apply tag rule ${ruleId}: ${(error as Error).message}`);
      throw error;
    }
  });

  ipcMain.handle('tag-corrections:get-all', async () => {
    try {
      return tagCorrectionQueries.getAllTagCorrections();
    } catch (error) {
      console.error('Error getting tag corrections:', error);
      throw error;
    }
  });

  ipcMain.handle('tag-corrections:create', async (_: IpcMainInvokeEvent, data: { tag_id: number; description: string; direction: 'positive' | 'negative' }) => {
    try {
      const id = tagCorrectionQueries.createTagCorrection(data);
      const correction = tagCorrectionQueries.getAllTagCorrections().find(c => c.id === id);
      const dirWord = data.direction === 'positive' ? 'positive' : 'negative';
      addLog('info', 'Tags', `Saved ${dirWord} training example for "${correction?.tag_name ?? data.tag_id}": "${data.description}"`);
      return correction;
    } catch (error) {
      addLog('error', 'Tags', `Failed to create tag correction: ${(error as Error).message}`);
      throw error;
    }
  });

  ipcMain.handle('tag-corrections:delete', async (_: IpcMainInvokeEvent, id: number) => {
    try {
      tagCorrectionQueries.deleteTagCorrection(id);
      addLog('info', 'Tags', `Deleted tag correction ${id}`);
    } catch (error) {
      addLog('error', 'Tags', `Failed to delete tag correction ${id}: ${(error as Error).message}`);
      throw error;
    }
  });

  console.log('Tag IPC handlers registered');
}
