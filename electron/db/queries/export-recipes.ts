import { getDatabase } from '../index';

export interface ExportRecipe {
  id: number;
  name: string;
  url: string;
  institution: string | null;
  steps: string; // JSON string
  account_id: number | null;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_scraping_method: string | null;
}

export interface ExportRecipeInput {
  name: string;
  url: string;
  institution?: string;
  steps: any[]; // Will be JSON stringified
  account_id?: number | null;
}

export const exportRecipeQueries = {
  getAll(): ExportRecipe[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM export_recipes ORDER BY name').all() as ExportRecipe[];
  },

  getById(id: number): ExportRecipe | null {
    const db = getDatabase();
    return db.prepare('SELECT * FROM export_recipes WHERE id = ?').get(id) as ExportRecipe | null;
  },

  create(input: ExportRecipeInput): number {
    const db = getDatabase();
    const stepsJson = JSON.stringify(input.steps);
    const result = db
      .prepare(
        'INSERT INTO export_recipes (name, url, institution, steps, account_id) VALUES (?, ?, ?, ?, ?)'
      )
      .run(input.name, input.url, input.institution || null, stepsJson, input.account_id || null);
    return result.lastInsertRowid as number;
  },

  update(id: number, input: Partial<ExportRecipeInput>): void {
    const db = getDatabase();
    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.url !== undefined) {
      updates.push('url = ?');
      values.push(input.url);
    }
    if (input.institution !== undefined) {
      updates.push('institution = ?');
      values.push(input.institution);
    }
    if (input.steps !== undefined) {
      updates.push('steps = ?');
      values.push(JSON.stringify(input.steps));
    }
    if (input.account_id !== undefined) {
      updates.push('account_id = ?');
      values.push(input.account_id);
    }

    if (updates.length === 0) return;

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE export_recipes SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },

  delete(id: number): void {
    const db = getDatabase();
    db.prepare('DELETE FROM export_recipes WHERE id = ?').run(id);
  },
};
