import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../../../../setup/db-helpers';

vi.mock('../../../../../electron/db/index', () => ({ getDatabase: vi.fn() }));

import { getDatabase } from '../../../../../electron/db/index';
import {
  createCategory,
  deleteCategory,
  getAllCategories,
} from '../../../../../electron/db/queries/categories';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
  vi.mocked(getDatabase).mockReturnValue(db);
});

describe('createCategory', () => {
  it('creates a new category and returns its id', () => {
    const id = createCategory({ name: 'Clothing', type: 'expense', is_system: false });
    expect(id).toBeGreaterThan(0);
  });

  it('strips trailing digits from the name', () => {
    const id1 = createCategory({ name: 'Fast Food 2', type: 'expense', is_system: false });
    const id2 = createCategory({ name: 'Fast Food', type: 'expense', is_system: false });
    // Both should map to the same "Fast Food" category
    expect(id1).toBe(id2);
  });

  it('strips a lone trailing bracket from the name', () => {
    // The regex strips a single trailing bracket char: 'Widgets)' → 'Widgets'
    const id1 = createCategory({ name: 'Widgets)', type: 'expense', is_system: false });
    const id2 = createCategory({ name: 'Widgets', type: 'expense', is_system: false });
    expect(id1).toBe(id2);
  });

  it('is case-insensitive — same name returns the same id', () => {
    const id1 = createCategory({ name: 'Entertainment', type: 'expense', is_system: false });
    const id2 = createCategory({ name: 'ENTERTAINMENT', type: 'expense', is_system: false });
    expect(id1).toBe(id2);
  });

  it('same name + different type = two separate categories', () => {
    const expId = createCategory({ name: 'Savings', type: 'expense', is_system: false });
    const incId = createCategory({ name: 'Savings', type: 'income', is_system: false });
    expect(expId).not.toBe(incId);
  });
});

describe('deleteCategory', () => {
  it('deletes a non-system category', () => {
    const id = createCategory({ name: 'Temp Category', type: 'expense', is_system: false });
    const beforeCount = getAllCategories().length;
    deleteCategory(id);
    expect(getAllCategories().length).toBe(beforeCount - 1);
  });

  it('does NOT delete a system category', () => {
    // System categories are seeded by initializeDatabase
    const systemCat = db
      .prepare('SELECT id FROM categories WHERE is_system = 1 LIMIT 1')
      .get() as { id: number };
    const beforeCount = getAllCategories().length;
    deleteCategory(systemCat.id);
    expect(getAllCategories().length).toBe(beforeCount);
  });
});
