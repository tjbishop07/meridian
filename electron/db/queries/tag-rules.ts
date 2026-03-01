import { getDatabase } from '../index';

export interface TagRule {
  id: number;
  tag_id: number;
  tag_name?: string;
  pattern: string;
  action: 'exclude' | 'include';
  created_at: string;
}

export function getAllTagRules(): TagRule[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT tr.*, t.name as tag_name
    FROM tag_rules tr
    JOIN tags t ON t.id = tr.tag_id
    ORDER BY tr.created_at DESC
  `).all() as TagRule[];
}

export function getInclusionRules(): TagRule[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT tr.*, t.name as tag_name
    FROM tag_rules tr
    JOIN tags t ON t.id = tr.tag_id
    WHERE tr.action = 'include'
    ORDER BY tr.created_at DESC
  `).all() as TagRule[];
}

export function getTagRulesForTag(tagId: number): TagRule[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM tag_rules WHERE tag_id = ? ORDER BY created_at DESC
  `).all(tagId) as TagRule[];
}

export function createTagRule(data: { tag_id: number; pattern: string; action?: 'exclude' | 'include' }): number {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO tag_rules (tag_id, pattern, action) VALUES (?, ?, ?)
  `).run(data.tag_id, data.pattern, data.action ?? 'exclude');
  return result.lastInsertRowid as number;
}

export function deleteTagRule(id: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM tag_rules WHERE id = ?').run(id);
}
