import { getDatabase } from '../index';
import type { Category } from '../../../src/types';

export function getAllCategories(): Category[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM categories ORDER BY type, name').all() as Category[];
}

export function getCategoryById(id: number): Category | null {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category) || null;
}

export function getCategoriesByType(type: 'income' | 'expense'): Category[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM categories WHERE type = ? ORDER BY name').all(type) as Category[];
}

export function createCategory(
  data: Omit<Category, 'id' | 'created_at'>
): Category {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO categories (name, type, parent_id, icon, color, is_system)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    data.name,
    data.type,
    data.parent_id || null,
    data.icon || null,
    data.color || null,
    data.is_system ? 1 : 0
  );

  const category = getCategoryById(result.lastInsertRowid as number);
  if (!category) {
    throw new Error('Failed to create category');
  }

  return category;
}

export function updateCategory(data: Partial<Category> & { id: number }): Category {
  const db = getDatabase();

  const fields: string[] = [];
  const params: any[] = [];

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

export function deleteCategory(id: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM categories WHERE id = ? AND is_system = 0').run(id);
}

export function deleteAllCategories(): number {
  const db = getDatabase();
  // Only delete non-system categories
  const result = db.prepare('DELETE FROM categories WHERE is_system = 0').run();
  return result.changes;
}
