import Database from 'better-sqlite3';
import { initializeDatabase, createUpdateTriggers } from '../../electron/db/schema';
import { runMigrations } from '../../electron/db/migrations';

/**
 * Create a fresh in-memory SQLite database with the full schema and all
 * migrations applied. Safe to call repeatedly — each call returns a brand
 * new, independent database.
 */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  initializeDatabase(db);   // fresh path → isFreshDatabase=true → full transfer-capable schema + seeded categories
  createUpdateTriggers(db);
  runMigrations(db);        // migration 1 self-detects column already exists → skips; 2–9 run normally
  return db;
}

/**
 * Insert a test account and return its id.
 */
export function seedAccount(
  db: Database.Database,
  overrides: Partial<{
    name: string;
    type: string;
    institution: string;
    balance: number;
  }> = {}
): number {
  const result = db
    .prepare(
      `INSERT INTO accounts (name, type, institution, balance, currency, is_active)
       VALUES (?, ?, ?, ?, 'USD', 1)`
    )
    .run(
      overrides.name ?? 'Test Checking',
      overrides.type ?? 'checking',
      overrides.institution ?? 'Test Bank',
      overrides.balance ?? 0
    );
  return result.lastInsertRowid as number;
}

/**
 * Return the id of a category with the given name+type, creating it if absent.
 * Avoids conflicts with the seeded system categories.
 */
export function seedCategory(
  db: Database.Database,
  overrides: Partial<{ name: string; type: string }> = {}
): number {
  const name = overrides.name ?? 'Test Category';
  const type = overrides.type ?? 'expense';

  const existing = db
    .prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND type = ?')
    .get(name, type) as { id: number } | undefined;
  if (existing) return existing.id;

  const result = db
    .prepare(`INSERT INTO categories (name, type, is_system) VALUES (?, ?, 0)`)
    .run(name, type);
  return result.lastInsertRowid as number;
}

/**
 * Insert a test transaction and return its id.
 */
export function seedTransaction(
  db: Database.Database,
  overrides: Partial<{
    account_id: number;
    category_id: number | null;
    date: string;
    description: string;
    amount: number;
    type: string;
    status: string;
  }> = {}
): number {
  const result = db
    .prepare(
      `INSERT INTO transactions (account_id, category_id, date, description, amount, type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      overrides.account_id ?? 1,
      overrides.category_id ?? null,
      overrides.date ?? '2025-01-15',
      overrides.description ?? 'Test Transaction',
      overrides.amount ?? -50.0,
      overrides.type ?? 'expense',
      overrides.status ?? 'cleared'
    );
  return result.lastInsertRowid as number;
}
