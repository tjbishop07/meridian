import Database from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'add_transfer_support',
    up: (db: Database.Database) => {
      // Check if linked_transaction_id column exists
      const columns = db.pragma('table_info(transactions)') as Array<{ name: string }>;
      const hasLinkedColumn = columns.some(col => col.name === 'linked_transaction_id');

      if (!hasLinkedColumn) {
        // Add linked_transaction_id column
        db.exec(`
          ALTER TABLE transactions ADD COLUMN linked_transaction_id INTEGER
          REFERENCES transactions(id) ON DELETE SET NULL;
        `);

        // Create index
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_transactions_linked
          ON transactions(linked_transaction_id);
        `);

        console.log('Migration 1: Added linked_transaction_id column');
      }

      // Update type CHECK constraint to include 'transfer'
      // SQLite doesn't support modifying CHECK constraints, so we need to:
      // 1. Create new table with updated constraint
      // 2. Copy data
      // 3. Drop old table
      // 4. Rename new table

      // Check if transfer type is already supported
      try {
        db.prepare(`INSERT INTO transactions (account_id, date, description, amount, type)
                   VALUES (1, '2025-01-01', 'test', 0, 'transfer')`).run();
        db.prepare(`DELETE FROM transactions WHERE description = 'test' AND amount = 0`).run();
        console.log('Migration 1: Transfer type already supported');
      } catch (error) {
        // Need to recreate table
        console.log('Migration 1: Recreating transactions table with transfer support');

        db.exec(`
          -- Create new transactions table with updated CHECK constraint
          CREATE TABLE transactions_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            category_id INTEGER,
            date TEXT NOT NULL,
            description TEXT NOT NULL,
            original_description TEXT,
            amount REAL NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer')),
            status TEXT NOT NULL DEFAULT 'cleared' CHECK(status IN ('pending', 'cleared', 'reconciled')),
            notes TEXT,
            external_id TEXT,
            linked_transaction_id INTEGER,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
            FOREIGN KEY (linked_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
            UNIQUE(account_id, date, amount, description)
          );

          -- Copy data from old table
          INSERT INTO transactions_new
          SELECT
            id, account_id, category_id, date, description, original_description,
            amount, type, status, notes, external_id,
            ${hasLinkedColumn ? 'linked_transaction_id' : 'NULL'},
            created_at, updated_at
          FROM transactions;

          -- Drop old table
          DROP TABLE transactions;

          -- Rename new table
          ALTER TABLE transactions_new RENAME TO transactions;

          -- Recreate indexes
          CREATE INDEX idx_transactions_account ON transactions(account_id);
          CREATE INDEX idx_transactions_category ON transactions(category_id);
          CREATE INDEX idx_transactions_date ON transactions(date DESC);
          CREATE INDEX idx_transactions_type ON transactions(type);
          CREATE INDEX idx_transactions_external ON transactions(external_id);
          CREATE INDEX idx_transactions_linked ON transactions(linked_transaction_id);
        `);
      }
    }
  },
  {
    version: 2,
    name: 'add_export_recipes_account_id',
    up: (db: Database.Database) => {
      // Check if account_id column exists in export_recipes
      const columns = db.pragma('table_info(export_recipes)') as Array<{ name: string }>;
      const hasAccountId = columns.some(col => col.name === 'account_id');

      if (!hasAccountId) {
        console.log('Migration 2: Adding account_id to export_recipes');

        // Add account_id column (nullable for existing recipes)
        db.exec(`
          ALTER TABLE export_recipes ADD COLUMN account_id INTEGER
          REFERENCES accounts(id) ON DELETE SET NULL;
        `);

        // Create index
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_export_recipes_account
          ON export_recipes(account_id);
        `);

        console.log('Migration 2: Added account_id column to export_recipes');
      } else {
        console.log('Migration 2: account_id column already exists');
      }
    }
  },
  {
    version: 3,
    name: 'add_export_recipes_last_run_at',
    up: (db: Database.Database) => {
      // Check if last_run_at column exists in export_recipes
      const columns = db.pragma('table_info(export_recipes)') as Array<{ name: string }>;
      const hasLastRunAt = columns.some(col => col.name === 'last_run_at');

      if (!hasLastRunAt) {
        console.log('Migration 3: Adding last_run_at to export_recipes');

        // Add last_run_at column (nullable - NULL means never run)
        db.exec(`
          ALTER TABLE export_recipes ADD COLUMN last_run_at TEXT;
        `);

        console.log('Migration 3: Added last_run_at column to export_recipes');
      } else {
        console.log('Migration 3: last_run_at column already exists');
      }
    }
  }
];

export function runMigrations(db: Database.Database): void {
  // Create migrations table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Get current version
  const currentVersion = (db.prepare('SELECT MAX(version) as version FROM migrations').get() as { version: number | null }).version || 0;

  // Run pending migrations
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`Running migration ${migration.version}: ${migration.name}`);

      db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO migrations (version, name) VALUES (?, ?)').run(migration.version, migration.name);
      })();

      console.log(`Migration ${migration.version} completed`);
    }
  }
}
