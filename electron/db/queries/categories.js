import { getDatabase } from '../index';
export function getAllCategories() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM categories ORDER BY type, name').all();
}
export function getCategoryById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) || null;
}
export function getCategoriesByType(type) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM categories WHERE type = ? ORDER BY name').all(type);
}
export function createCategory(data) {
    const db = getDatabase();
    // Normalize: strip trailing numbers/brackets, collapse whitespace
    let cleanName = data.name
        .trim()
        .replace(/\s*\d+\s*$/g, '')
        .replace(/\s*[\(\)\[\]\{\}]\s*\d*\s*$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleanName)
        cleanName = data.name.trim();
    // Final pass if trailing digit survived
    if (/\d$/.test(cleanName)) {
        cleanName = cleanName.replace(/\s*\d+$/g, '').trim();
    }
    if (cleanName !== data.name.trim()) {
        console.log(`[DB] Category name sanitized: "${data.name}" → "${cleanName}"`);
    }
    // Return existing ID if already present (case-insensitive)
    const existing = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND type = ?').get(cleanName, data.type);
    if (existing) {
        return existing.id;
    }
    // INSERT OR IGNORE as a safety net (UNIQUE index prevents duplicates at DB level)
    const result = db.prepare(`
    INSERT OR IGNORE INTO categories (name, type, parent_id, icon, color, is_system)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(cleanName, data.type, data.parent_id || null, data.icon || null, data.color || null, data.is_system ? 1 : 0);
    if (result.lastInsertRowid) {
        return result.lastInsertRowid;
    }
    // Race-condition fallback: another process inserted between our SELECT and INSERT
    const inserted = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND type = ?').get(cleanName, data.type);
    return inserted.id;
}
export function updateCategory(data) {
    const db = getDatabase();
    const fields = [];
    const params = [];
    if (data.name !== undefined) {
        fields.push('name = ?');
        params.push(data.name);
    }
    if (data.type !== undefined) {
        fields.push('type = ?');
        params.push(data.type);
    }
    if (data.parent_id !== undefined) {
        fields.push('parent_id = ?');
        params.push(data.parent_id);
    }
    if (data.icon !== undefined) {
        fields.push('icon = ?');
        params.push(data.icon);
    }
    if (data.color !== undefined) {
        fields.push('color = ?');
        params.push(data.color);
    }
    if (fields.length === 0) {
        throw new Error('No fields to update');
    }
    params.push(data.id);
    const stmt = db.prepare(`
    UPDATE categories
    SET ${fields.join(', ')}
    WHERE id = ?
  `);
    stmt.run(...params);
    const category = getCategoryById(data.id);
    if (!category) {
        throw new Error('Failed to update category');
    }
    return category;
}
export function deleteCategory(id) {
    const db = getDatabase();
    db.prepare('DELETE FROM categories WHERE id = ? AND is_system = 0').run(id);
}
export function deleteAllCategories() {
    const db = getDatabase();
    // Only delete non-system categories
    const result = db.prepare('DELETE FROM categories WHERE is_system = 0').run();
    return result.changes;
}
