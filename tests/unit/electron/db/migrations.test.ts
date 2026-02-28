import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations, migrations } from '../../../../electron/db/migrations';
import { initializeDatabase } from '../../../../electron/db/schema';

/** Fresh in-memory DB with full schema applied but NO migrations run yet. */
function createSchemaOnlyDb(): Database.Database {
  const db = new Database(':memory:');
  initializeDatabase(db);
  return db;
}

/**
 * Minimal DB that resembles a pre-migration production database:
 * - transactions table WITHOUT linked_transaction_id (migration 1 target)
 * - export_recipes WITHOUT account_id / last_run_at / last_scraping_method (migrations 2-4 targets)
 * - transactions WITHOUT balance column (migration 5 target)
 * - categories WITHOUT unique index (migration 6 target)
 * - No tags tables (migration 7 target)
 * - No receipts table (migration 9 target)
 */
function createLegacySchemaDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = OFF');

  db.exec(`
    CREATE TABLE accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'checking',
      institution TEXT NOT NULL DEFAULT 'Bank',
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      is_active BOOLEAN NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO accounts (name) VALUES ('Test');

    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      parent_id INTEGER,
      icon TEXT,
      color TEXT,
      is_system BOOLEAN NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Old transactions table: no linked_transaction_id, no balance, type only allows income/expense
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      category_id INTEGER,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      original_description TEXT,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      status TEXT NOT NULL DEFAULT 'cleared' CHECK(status IN ('pending', 'cleared', 'reconciled')),
      notes TEXT,
      external_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE export_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'Recipe'
    );

    CREATE TABLE budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      month TEXT,
      amount REAL,
      rollover INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'Bill'
    );

    CREATE TABLE goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'Goal'
    );

    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE automation_settings (
      id INTEGER PRIMARY KEY DEFAULT 1
    );
  `);

  return db;
}

// ---------------------------------------------------------------------------
// runMigrations — tracking behaviour
// ---------------------------------------------------------------------------

describe('runMigrations – tracking', () => {
  it('creates the migrations table when it does not exist', () => {
    const db = createSchemaOnlyDb();
    runMigrations(db);

    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'")
      .get();
    expect(table).toBeDefined();
  });

  it('records an entry for every migration that was applied', () => {
    const db = createSchemaOnlyDb();
    runMigrations(db);

    const rows = db.prepare('SELECT version FROM migrations ORDER BY version').all() as { version: number }[];
    const versions = rows.map((r) => r.version);
    // All 9 migrations should be recorded
    expect(versions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('is idempotent — running a second time adds no new migration rows', () => {
    const db = createSchemaOnlyDb();
    runMigrations(db);
    runMigrations(db); // second run

    const count = (
      db.prepare('SELECT COUNT(*) as n FROM migrations').get() as { n: number }
    ).n;
    expect(count).toBe(migrations.length);
  });

  it('only runs migrations newer than the recorded version', () => {
    const db = createSchemaOnlyDb();

    // Pre-seed the migrations table up to version 5
    db.exec(`CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    for (let v = 1; v <= 5; v++) {
      db.prepare('INSERT INTO migrations (version, name) VALUES (?, ?)').run(v, `migration_${v}`);
    }

    // Manually apply columns that migrations 2-5 would have added, so their up() won't error
    db.exec(`ALTER TABLE export_recipes ADD COLUMN account_id INTEGER`);
    db.exec(`ALTER TABLE export_recipes ADD COLUMN last_run_at TEXT`);
    db.exec(`ALTER TABLE export_recipes ADD COLUMN last_scraping_method TEXT`);
    db.exec(`ALTER TABLE transactions ADD COLUMN balance REAL`);

    runMigrations(db);

    const rows = db.prepare('SELECT version FROM migrations ORDER BY version').all() as { version: number }[];
    const versions = rows.map((r) => r.version);
    // Should have 1-9; 1-5 were pre-seeded, 6-9 should now be added
    expect(versions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

// ---------------------------------------------------------------------------
// Migration 1: add transfer support
// ---------------------------------------------------------------------------

describe('migration 1: add_transfer_support', () => {
  it('adds linked_transaction_id column to old schema and allows transfer type', () => {
    const db = createLegacySchemaDb();

    migrations[0].up(db);

    const columns = db.pragma('table_info(transactions)') as Array<{ name: string }>;
    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain('linked_transaction_id');

    // Transfer type should now be insertable (FK off, so account_id=1 is fine)
    expect(() => {
      db.prepare(
        `INSERT INTO transactions (account_id, date, description, amount, type)
         VALUES (1, '2025-01-01', 'test transfer', -100, 'transfer')`
      ).run();
    }).not.toThrow();
  });

  it('is safe to run on a schema that already has linked_transaction_id', () => {
    const db = createSchemaOnlyDb();

    // Should not throw even though the column already exists
    expect(() => migrations[0].up(db)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Migration 2–4: export_recipes columns
// ---------------------------------------------------------------------------

describe('migrations 2–4: export_recipes columns', () => {
  it('migration 2 adds account_id column', () => {
    const db = createLegacySchemaDb();
    migrations[1].up(db);

    const cols = (db.pragma('table_info(export_recipes)') as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toContain('account_id');
  });

  it('migration 3 adds last_run_at column', () => {
    const db = createLegacySchemaDb();
    migrations[2].up(db);

    const cols = (db.pragma('table_info(export_recipes)') as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toContain('last_run_at');
  });

  it('migration 4 adds last_scraping_method column', () => {
    const db = createLegacySchemaDb();
    migrations[3].up(db);

    const cols = (db.pragma('table_info(export_recipes)') as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toContain('last_scraping_method');
  });

  it('migrations 2–4 are idempotent', () => {
    const db = createSchemaOnlyDb();
    expect(() => {
      migrations[1].up(db);
      migrations[1].up(db);
      migrations[2].up(db);
      migrations[2].up(db);
      migrations[3].up(db);
      migrations[3].up(db);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Migration 5: transactions.balance column
// ---------------------------------------------------------------------------

describe('migration 5: add_transactions_balance', () => {
  it('adds balance column to transactions', () => {
    const db = createLegacySchemaDb();
    migrations[4].up(db);

    const cols = (db.pragma('table_info(transactions)') as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toContain('balance');
  });

  it('is idempotent', () => {
    const db = createSchemaOnlyDb();
    expect(() => {
      migrations[4].up(db);
      migrations[4].up(db);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Migration 6: deduplicate_categories_unique_index
// ---------------------------------------------------------------------------

/** Minimal DB with categories + transactions tables, no unique index yet. */
function createDbForMigration6(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      is_system BOOLEAN NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL DEFAULT 1,
      category_id INTEGER,
      date TEXT NOT NULL DEFAULT '2025-01-01',
      description TEXT NOT NULL DEFAULT 'tx',
      amount REAL NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'expense',
      status TEXT NOT NULL DEFAULT 'cleared',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

describe('migration 6: deduplicate_categories_unique_index', () => {
  it('removes duplicate categories keeping the lowest id', () => {
    const db = createDbForMigration6();
    db.exec(`
      INSERT INTO categories (name, type) VALUES ('Groceries', 'expense');
      INSERT INTO categories (name, type) VALUES ('groceries', 'expense');
      INSERT INTO categories (name, type) VALUES ('GROCERIES', 'expense');
    `);

    migrations[5].up(db);

    const rows = db.prepare('SELECT * FROM categories').all() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(1); // lowest id survives
  });

  it('re-points transactions from duplicate categories to the surviving one', () => {
    const db = createDbForMigration6();
    db.exec(`
      INSERT INTO categories (name, type) VALUES ('Dining', 'expense');  -- id 1, survives
      INSERT INTO categories (name, type) VALUES ('dining', 'expense');  -- id 2, duplicate
    `);
    // Transaction linked to the duplicate (id 2)
    db.exec(`INSERT INTO transactions (category_id, description) VALUES (2, 'Restaurant')`);

    migrations[5].up(db);

    const tx = db.prepare('SELECT category_id FROM transactions WHERE description = ?').get('Restaurant') as { category_id: number };
    expect(tx.category_id).toBe(1); // re-pointed to surviving id
  });

  it('adds a unique index that prevents future duplicate category insertion', () => {
    const db = createDbForMigration6();
    db.exec(`INSERT INTO categories (name, type) VALUES ('Rent', 'expense')`);

    migrations[5].up(db);

    expect(() => {
      db.prepare(`INSERT INTO categories (name, type) VALUES ('rent', 'expense')`).run();
    }).toThrow();
  });

  it('preserves categories with the same name but different types', () => {
    const db = createDbForMigration6();
    db.exec(`
      INSERT INTO categories (name, type) VALUES ('Salary', 'income');
      INSERT INTO categories (name, type) VALUES ('Salary', 'expense');
    `);

    migrations[5].up(db);

    const rows = db.prepare('SELECT * FROM categories').all() as any[];
    expect(rows).toHaveLength(2); // distinct types, both survive
  });
});

// ---------------------------------------------------------------------------
// Migration 7: add_tags
// ---------------------------------------------------------------------------

describe('migration 7: add_tags', () => {
  it('creates tags and transaction_tags tables', () => {
    const db = createLegacySchemaDb();
    migrations[6].up(db);

    const tableNames = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((r) => r.name);

    expect(tableNames).toContain('tags');
    expect(tableNames).toContain('transaction_tags');
  });

  it('seeds the default tags', () => {
    const db = createLegacySchemaDb();
    migrations[6].up(db);

    const tags = db.prepare('SELECT name FROM tags').all() as { name: string }[];
    const names = tags.map((t) => t.name);
    expect(names).toContain('Subscriptions');
    expect(names).toContain('Recurring');
    expect(names).toContain('Travel');
  });

  it('is idempotent — running twice does not duplicate tags', () => {
    const db = createLegacySchemaDb();
    migrations[6].up(db);
    migrations[6].up(db); // second run

    const count = (db.prepare('SELECT COUNT(*) as n FROM tags').get() as { n: number }).n;
    expect(count).toBe(6); // exactly the 6 default tags
  });
});

// ---------------------------------------------------------------------------
// Migration 8: add_tag_description
// ---------------------------------------------------------------------------

describe('migration 8: add_tag_description', () => {
  it('adds description column to tags table', () => {
    const db = createLegacySchemaDb();
    migrations[6].up(db); // tags table must exist first
    migrations[7].up(db);

    const cols = (db.pragma('table_info(tags)') as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toContain('description');
  });

  it('is idempotent', () => {
    const db = createLegacySchemaDb();
    migrations[6].up(db);
    expect(() => {
      migrations[7].up(db);
      migrations[7].up(db);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Migration 9: add_receipts
// ---------------------------------------------------------------------------

describe('migration 9: add_receipts', () => {
  it('creates the receipts table', () => {
    const db = createLegacySchemaDb();
    migrations[8].up(db);

    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='receipts'")
      .get();
    expect(table).toBeDefined();
  });

  it('receipts table has the expected columns', () => {
    const db = createLegacySchemaDb();
    migrations[8].up(db);

    const cols = (db.pragma('table_info(receipts)') as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toContain('transaction_id');
    expect(cols).toContain('file_path');
    expect(cols).toContain('extracted_data');
    expect(cols).toContain('ai_model');
  });

  it('is idempotent', () => {
    const db = createLegacySchemaDb();
    expect(() => {
      migrations[8].up(db);
      migrations[8].up(db);
    }).not.toThrow();
  });
});
