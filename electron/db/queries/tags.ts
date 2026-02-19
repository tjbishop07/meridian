import { getDatabase } from '../index';
import type { Tag, TagStat } from '../../../src/types';
import type { Transaction } from '../../../src/types';

export function getAllTags(): Tag[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM tags ORDER BY name').all() as Tag[];
}

export function getTagsForTransaction(transactionId: number): Tag[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT t.* FROM tags t
    INNER JOIN transaction_tags tt ON tt.tag_id = t.id
    WHERE tt.transaction_id = ?
    ORDER BY t.name
  `).all(transactionId) as Tag[];
}

export function getTagStats(): TagStat[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      t.id,
      t.name,
      t.color,
      t.created_at,
      COUNT(tt.transaction_id) as count,
      COALESCE(SUM(ABS(tr.amount)), 0) as total_amount
    FROM tags t
    LEFT JOIN transaction_tags tt ON tt.tag_id = t.id
    LEFT JOIN transactions tr ON tr.id = tt.transaction_id
    GROUP BY t.id
    ORDER BY t.name
  `).all() as TagStat[];
}

export function createTag(data: { name: string; color: string }): number {
  const db = getDatabase();

  const existing = db.prepare(
    'SELECT id FROM tags WHERE LOWER(name) = LOWER(?)'
  ).get(data.name) as { id: number } | undefined;

  if (existing) return existing.id;

  const result = db.prepare(
    'INSERT INTO tags (name, color) VALUES (?, ?)'
  ).run(data.name, data.color);

  return result.lastInsertRowid as number;
}

export function updateTag(data: { id: number; name?: string; color?: string }): Tag {
  const db = getDatabase();

  const fields: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    params.push(data.name);
  }
  if (data.color !== undefined) {
    fields.push('color = ?');
    params.push(data.color);
  }

  if (fields.length === 0) throw new Error('No fields to update');

  params.push(data.id);
  db.prepare(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  return db.prepare('SELECT * FROM tags WHERE id = ?').get(data.id) as Tag;
}

export function deleteTag(id: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM tags WHERE id = ?').run(id);
}

export function setTagsForTransaction(transactionId: number, tagIds: number[]): void {
  const db = getDatabase();

  db.transaction(() => {
    db.prepare('DELETE FROM transaction_tags WHERE transaction_id = ?').run(transactionId);
    const insert = db.prepare(
      'INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)'
    );
    for (const tagId of tagIds) {
      insert.run(transactionId, tagId);
    }
  })();
}

export function getTransactionsForTag(tagId: number): Transaction[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT tr.*, a.name as account_name, c.name as category_name
    FROM transactions tr
    INNER JOIN transaction_tags tt ON tt.transaction_id = tr.id
    LEFT JOIN accounts a ON a.id = tr.account_id
    LEFT JOIN categories c ON c.id = tr.category_id
    WHERE tt.tag_id = ?
    ORDER BY tr.date DESC
  `).all(tagId) as Transaction[];
}

export function getAllTransactionTags(): Array<{ transaction_id: number; tag_id: number; tag_name: string; tag_color: string }> {
  const db = getDatabase();
  return db.prepare(`
    SELECT tt.transaction_id, tt.tag_id, t.name as tag_name, t.color as tag_color
    FROM transaction_tags tt
    INNER JOIN tags t ON t.id = tt.tag_id
  `).all() as Array<{ transaction_id: number; tag_id: number; tag_name: string; tag_color: string }>;
}
