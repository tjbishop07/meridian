import Database from 'better-sqlite3';

export function initializeDatabase(db: Database.Database): void {
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Check if this is a fresh database or needs migration
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'").all();
  const isFreshDatabase = tables.length === 0;

  // Accounts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('checking', 'savings', 'credit_card', 'investment', 'other')),
      institution TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      is_active BOOLEAN NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(is_active);
  `);

  // Categories table (hierarchical)
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      parent_id INTEGER,
      icon TEXT,
      color TEXT,
      is_system BOOLEAN NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);
    CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
  `);

  // Transactions table
  // For fresh databases, create with transfer support
  // For existing databases, migration will handle the update
  if (isFreshDatabase) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
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

      CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_transactions_external ON transactions(external_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_linked ON transactions(linked_transaction_id);
    `);
  } else {
    // For existing databases, create table with old schema (migration will update it)
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
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
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        UNIQUE(account_id, date, amount, description)
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_transactions_external ON transactions(external_id);
    `);
  }

  // Budgets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      amount REAL NOT NULL,
      rollover BOOLEAN NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      UNIQUE(category_id, month)
    );

    CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);
    CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category_id);
  `);

  // Goals table
  db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL NOT NULL DEFAULT 0,
      target_date TEXT,
      category_id INTEGER,
      is_completed BOOLEAN NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_goals_completed ON goals(is_completed);
  `);

  // Goal contributions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS goal_contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON goal_contributions(goal_id);
  `);

  // Bills table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id INTEGER,
      due_day INTEGER NOT NULL CHECK(due_day >= 1 AND due_day <= 31),
      frequency TEXT NOT NULL CHECK(frequency IN ('monthly', 'quarterly', 'yearly')),
      account_id INTEGER,
      is_autopay BOOLEAN NOT NULL DEFAULT 0,
      reminder_days INTEGER NOT NULL DEFAULT 3,
      is_active BOOLEAN NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bills_active ON bills(is_active);
    CREATE INDEX IF NOT EXISTS idx_bills_due ON bills(due_day);
  `);

  // Bill payments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bill_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      transaction_id INTEGER,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bill_payments_bill ON bill_payments(bill_id);
    CREATE INDEX IF NOT EXISTS idx_bill_payments_date ON bill_payments(date);
  `);

  // Import history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      account_id INTEGER NOT NULL,
      import_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      format TEXT NOT NULL,
      rows_imported INTEGER NOT NULL,
      rows_skipped INTEGER NOT NULL,
      date_range_start TEXT,
      date_range_end TEXT,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_import_history_account ON import_history(account_id);
    CREATE INDEX IF NOT EXISTS idx_import_history_date ON import_history(import_date);
  `);

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Export recipes table (saved browser recordings)
  db.exec(`
    CREATE TABLE IF NOT EXISTS export_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      institution TEXT,
      steps TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_export_recipes_institution ON export_recipes(institution);
  `);

  // Sync metadata table (for future use)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      table_name TEXT PRIMARY KEY,
      last_sync TEXT,
      sync_token TEXT
    );
  `);

  // Automation settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS automation_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert default automation settings
  db.exec(`
    INSERT OR IGNORE INTO automation_settings (key, value) VALUES
      ('vision_provider', 'claude'),
      ('claude_api_key', ''),
      ('retry_attempts', '3'),
      ('retry_delay_ms', '2000'),
      ('schedule_enabled', 'false'),
      ('schedule_cron', '0 6 * * *');
  `);

  // Automation schedules table
  db.exec(`
    CREATE TABLE IF NOT EXISTS automation_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL,
      schedule_cron TEXT NOT NULL,
      is_enabled BOOLEAN DEFAULT 1,
      last_run TEXT,
      last_status TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recipe_id) REFERENCES export_recipes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_automation_schedules_recipe ON automation_schedules(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_automation_schedules_enabled ON automation_schedules(is_enabled);
  `);

  // Seed default categories if empty
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };

  if (categoryCount.count === 0) {
    seedDefaultCategories(db);
  }

  console.log('Database schema initialized successfully');
}

function seedDefaultCategories(db: Database.Database): void {
  const categories = [
    // Income categories
    { name: 'Income', type: 'income', parent_id: null, icon: 'DollarSign', color: '#10b981', is_system: 1 },
    { name: 'Paycheck', type: 'income', parent_id: null, icon: 'Briefcase', color: '#10b981', is_system: 1 },
    { name: 'Investment Income', type: 'income', parent_id: null, icon: 'TrendingUp', color: '#10b981', is_system: 0 },
    { name: 'Other Income', type: 'income', parent_id: null, icon: 'Plus', color: '#10b981', is_system: 0 },

    // Expense categories - Essential
    { name: 'Housing', type: 'expense', parent_id: null, icon: 'Home', color: '#3b82f6', is_system: 1 },
    { name: 'Transportation', type: 'expense', parent_id: null, icon: 'Car', color: '#ef4444', is_system: 1 },
    { name: 'Groceries', type: 'expense', parent_id: null, icon: 'ShoppingCart', color: '#f59e0b', is_system: 1 },
    { name: 'Utilities', type: 'expense', parent_id: null, icon: 'Zap', color: '#6366f1', is_system: 1 },
    { name: 'Healthcare', type: 'expense', parent_id: null, icon: 'Heart', color: '#ec4899', is_system: 1 },

    // Expense categories - Discretionary
    { name: 'Dining Out', type: 'expense', parent_id: null, icon: 'Utensils', color: '#f97316', is_system: 1 },
    { name: 'Entertainment', type: 'expense', parent_id: null, icon: 'Film', color: '#8b5cf6', is_system: 1 },
    { name: 'Shopping', type: 'expense', parent_id: null, icon: 'ShoppingBag', color: '#ec4899', is_system: 1 },
    { name: 'Travel', type: 'expense', parent_id: null, icon: 'Plane', color: '#06b6d4', is_system: 0 },
    { name: 'Subscriptions', type: 'expense', parent_id: null, icon: 'Repeat', color: '#8b5cf6', is_system: 0 },

    // Expense categories - Financial
    { name: 'Insurance', type: 'expense', parent_id: null, icon: 'Shield', color: '#64748b', is_system: 0 },
    { name: 'Savings', type: 'expense', parent_id: null, icon: 'Piggybank', color: '#10b981', is_system: 0 },
    { name: 'Investments', type: 'expense', parent_id: null, icon: 'TrendingUp', color: '#10b981', is_system: 0 },

    // Catch-all
    { name: 'Uncategorized', type: 'expense', parent_id: null, icon: 'HelpCircle', color: '#9ca3af', is_system: 1 },
  ];

  const stmt = db.prepare(`
    INSERT INTO categories (name, type, parent_id, icon, color, is_system)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const cat of categories) {
    stmt.run(cat.name, cat.type, cat.parent_id, cat.icon, cat.color, cat.is_system);
  }

  console.log('Seeded default categories');
}

// Update triggers for updated_at
export function createUpdateTriggers(db: Database.Database): void {
  const tables = ['accounts', 'transactions', 'goals', 'bills'];

  for (const table of tables) {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_${table}_timestamp
      AFTER UPDATE ON ${table}
      FOR EACH ROW
      BEGIN
        UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);
  }
}
