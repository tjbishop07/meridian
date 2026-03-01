import { getDatabase } from '../index';

export interface TagCorrection {
  id: number;
  tag_id: number;
  tag_name?: string;
  tag_color?: string;
  description: string;
  direction: 'positive' | 'negative';
  created_at: string;
}

export function getAllTagCorrections(): TagCorrection[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT tc.*, t.name as tag_name, t.color as tag_color
    FROM tag_corrections tc
    JOIN tags t ON t.id = tc.tag_id
    ORDER BY tc.created_at DESC
  `).all() as TagCorrection[];
}

export function createTagCorrection(data: { tag_id: number; description: string; direction: 'positive' | 'negative' }): number {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO tag_corrections (tag_id, description, direction) VALUES (?, ?, ?)
  `).run(data.tag_id, data.description, data.direction);
  return result.lastInsertRowid as number;
}

export function deleteTagCorrection(id: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM tag_corrections WHERE id = ?').run(id);
}
