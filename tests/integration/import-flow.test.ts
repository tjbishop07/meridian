/**
 * Integration test: full CSV import pipeline
 * parse → deduplicate → bulk insert (end-to-end)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb, seedAccount } from '../setup/db-helpers';

vi.mock('../../electron/db/index', () => ({ getDatabase: vi.fn() }));
vi.mock('../../electron/db', () => ({ getDatabase: vi.fn() }));
vi.mock('fs', () => ({
  default: { readFileSync: vi.fn() },
  readFileSync: vi.fn(),
}));
vi.mock('../../electron/ipc/logs', () => ({ addLog: vi.fn() }));

import { getDatabase } from '../../electron/db/index';
import { getDatabase as getDbFromDb } from '../../electron/db';
import fs from 'fs';
import { parseCSV } from '../../electron/services/csv-parser';
import { findDuplicates, removeDuplicates } from '../../electron/services/duplicate-detector';
import { bulkCreateTransactions, getAllTransactions } from '../../electron/db/queries/transactions';
import type { CSVFormat } from '../../src/types';
import type Database from 'better-sqlite3';

const FORMAT: CSVFormat = {
  name: 'USAA',
  institution: 'USAA',
  columns: {
    date: 'Date',
    description: 'Description',
    amount: 'Amount',
    category: 'Category',
    status: 'Status',
  },
  dateFormat: 'yyyy-MM-dd',
  amountMultiplier: 1,
};

const CSV_CONTENT = `Date,Description,Amount,Category,Status
2025-08-01,Coffee,-5.00,Dining,Posted
2025-08-02,Paycheck,3000.00,Income,Posted`;

let db: Database.Database;
let accountId: number;

beforeEach(() => {
  db = createTestDb();
  vi.mocked(getDatabase).mockReturnValue(db);
  vi.mocked(getDbFromDb).mockReturnValue(db);
  accountId = seedAccount(db);
});

async function runImport(csvContent: string) {
  vi.mocked(fs.readFileSync).mockReturnValue(csvContent as unknown as Buffer);

  const parsed = await parseCSV('/fake/file.csv', FORMAT);
  const duplicates = await findDuplicates(accountId, parsed);
  const clean = removeDuplicates(parsed, duplicates);

  // Map ParsedCSVRow → CreateTransactionInput
  const inputs = clean.map((row) => ({
    account_id: accountId,
    date: row.date,
    description: row.description,
    original_description: row.original_description,
    amount: row.amount,
    balance: row.balance,
    type: (row.amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
    status: row.status,
  }));

  return bulkCreateTransactions(inputs);
}

describe('import pipeline', () => {
  it('imports 2 new transactions from a fresh CSV', async () => {
    const inserted = await runImport(CSV_CONTENT);
    expect(inserted).toBe(2);

    const all = getAllTransactions({ account_id: accountId });
    expect(all).toHaveLength(2);
  });

  it('imports 0 new transactions on second identical import (no dupes)', async () => {
    await runImport(CSV_CONTENT);

    // Second import of same file should detect all rows as duplicates
    const secondInserted = await runImport(CSV_CONTENT);
    expect(secondInserted).toBe(0);

    // Still only 2 rows in DB
    expect(getAllTransactions({ account_id: accountId })).toHaveLength(2);
  });

  it('imports only new rows when partial overlap', async () => {
    await runImport(CSV_CONTENT);

    const extendedCsv = `Date,Description,Amount,Category,Status
2025-08-01,Coffee,-5.00,Dining,Posted
2025-08-02,Paycheck,3000.00,Income,Posted
2025-08-03,Groceries,-80.00,Food,Posted`;

    const newInserted = await runImport(extendedCsv);
    expect(newInserted).toBe(1);

    expect(getAllTransactions({ account_id: accountId })).toHaveLength(3);
  });
});
