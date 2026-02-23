import { getDatabase } from '../index';
export function getAllTags() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM tags ORDER BY name').all();
}
export function getTagsForTransaction(transactionId) {
    const db = getDatabase();
    return db.prepare(`
    SELECT t.* FROM tags t
    INNER JOIN transaction_tags tt ON tt.tag_id = t.id
    WHERE tt.transaction_id = ?
    ORDER BY t.name
  `).all(transactionId);
}
export function getTagStats() {
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
  `).all();
}
export function createTag(data) {
    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM tags WHERE LOWER(name) = LOWER(?)').get(data.name);
    if (existing)
        return existing.id;
    const result = db.prepare('INSERT INTO tags (name, color, description) VALUES (?, ?, ?)').run(data.name, data.color, data.description ?? null);
    return result.lastInsertRowid;
}
export function updateTag(data) {
    const db = getDatabase();
    const fields = [];
    const params = [];
    if (data.name !== undefined) {
        fields.push('name = ?');
        params.push(data.name);
    }
    if (data.color !== undefined) {
        fields.push('color = ?');
        params.push(data.color);
    }
    if (data.description !== undefined) {
        fields.push('description = ?');
        params.push(data.description);
    }
    if (fields.length === 0)
        throw new Error('No fields to update');
    params.push(data.id);
    db.prepare(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return db.prepare('SELECT * FROM tags WHERE id = ?').get(data.id);
}
export function getTagMonthlyStats(months = 6) {
    const db = getDatabase();
    return db.prepare(`
    SELECT
      t.id   AS tag_id,
      t.name AS tag_name,
      t.color AS tag_color,
      strftime('%Y-%m', tr.date) AS month,
      COUNT(*) AS count,
      COALESCE(SUM(ABS(tr.amount)), 0) AS total_amount
    FROM tags t
    JOIN transaction_tags tt ON tt.tag_id = t.id
    JOIN transactions tr ON tr.id = tt.transaction_id
    WHERE tr.date >= date('now', '-' || ? || ' months')
    GROUP BY t.id, strftime('%Y-%m', tr.date)
    ORDER BY t.name, month
  `).all(months);
}
export function deleteTag(id) {
    const db = getDatabase();
    db.prepare('DELETE FROM tags WHERE id = ?').run(id);
}
export function setTagsForTransaction(transactionId, tagIds) {
    const db = getDatabase();
    db.transaction(() => {
        db.prepare('DELETE FROM transaction_tags WHERE transaction_id = ?').run(transactionId);
        const insert = db.prepare('INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)');
        for (const tagId of tagIds) {
            insert.run(transactionId, tagId);
        }
    })();
}
export function getTransactionsForTag(tagId) {
    const db = getDatabase();
    return db.prepare(`
    SELECT tr.*, a.name as account_name, c.name as category_name
    FROM transactions tr
    INNER JOIN transaction_tags tt ON tt.transaction_id = tr.id
    LEFT JOIN accounts a ON a.id = tr.account_id
    LEFT JOIN categories c ON c.id = tr.category_id
    WHERE tt.tag_id = ?
    ORDER BY tr.date DESC
  `).all(tagId);
}
export function getAllTransactionTags() {
    const db = getDatabase();
    return db.prepare(`
    SELECT tt.transaction_id, tt.tag_id, t.name as tag_name, t.color as tag_color
    FROM transaction_tags tt
    INNER JOIN tags t ON t.id = tt.tag_id
  `).all();
}
