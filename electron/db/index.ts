import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { initializeDatabase, createUpdateTriggers } from './schema';
import { runMigrations } from './migrations';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
}

export function initDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // Store database in app's user data directory
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'finance.db');

  console.log('Initializing database at:', dbPath);

  db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
  });

  // Configure SQLite for better performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB cache

  // Initialize schema and triggers
  initializeDatabase(db);
  createUpdateTriggers(db);

  // Run migrations
  runMigrations(db);

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('Database connection closed');
  }
}

// Helper function for transactions
export function transaction<T>(fn: () => T): T {
  const database = getDatabase();
  const txn = database.transaction(fn);
  return txn();
}

// Helper for batch inserts
export function batchInsert<T extends Record<string, any>>(
  table: string,
  rows: T[]
): number {
  if (rows.length === 0) return 0;

  const db = getDatabase();
  const columns = Object.keys(rows[0]);
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

  const stmt = db.prepare(sql);

  return transaction(() => {
    let count = 0;
    for (const row of rows) {
      const values = columns.map(col => row[col]);
      stmt.run(...values);
      count++;
    }
    return count;
  });
}
