import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDb, seedAccount, seedTransaction } from '../../../setup/db-helpers';

// duplicate-detector imports from '../db' (resolves to electron/db/index.ts)
vi.mock('../../../../electron/db', () => ({ getDatabase: vi.fn() }));
vi.mock('../../../../electron/ipc/logs', () => ({ addLog: vi.fn() }));

import { getDatabase } from '../../../../electron/db';
import {
  findDuplicates,
  removeDuplicates,
} from '../../../../electron/services/duplicate-detector';
import type { ParsedCSVRow } from '../../../../src/types';
import type Database from 'better-sqlite3';

let db: Database.Database;
let accountId: number;

function makeRow(overrides: Partial<ParsedCSVRow> = {}): ParsedCSVRow {
  return {
    date: '2025-06-01',
    description: 'Starbucks',
    original_description: 'STARBUCKS #1234',
    amount: -5.5,
    status: 'cleared',
    ...overrides,
  };
}

beforeEach(() => {
  db = createTestDb();
  vi.mocked(getDatabase).mockReturnValue(db);
  accountId = seedAccount(db);
});

describe('findDuplicates', () => {
  it('returns empty array when no existing transactions', async () => {
    const dupes = await findDuplicates(accountId, [makeRow()]);
    expect(dupes).toHaveLength(0);
  });

  it('detects an exact duplicate (confidence = 1)', async () => {
    seedTransaction(db, {
      account_id: accountId,
      date: '2025-06-01',
      description: 'Starbucks',
      amount: -5.5,
    });

    const dupes = await findDuplicates(accountId, [makeRow()]);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].matchType).toBe('exact');
    expect(dupes[0].confidence).toBe(1.0);
  });

  it('detects a fuzzy match with confidence ≥ 0.7', async () => {
    // Descriptions that differ by a single digit: similarity ≈ 0.93, well above the 0.7 threshold
    seedTransaction(db, {
      account_id: accountId,
      date: '2025-06-01',
      description: 'Starbucks #1234',
      amount: -5.5,
    });

    const dupes = await findDuplicates(accountId, [makeRow({ description: 'Starbucks #1235' })]);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].confidence).toBeGreaterThanOrEqual(0.7);
    expect(dupes[0].matchType).toBe('fuzzy');
  });

  it('does NOT flag different date+amount as duplicate', async () => {
    seedTransaction(db, {
      account_id: accountId,
      date: '2025-05-01',
      description: 'Starbucks',
      amount: -10.0,
    });

    const dupes = await findDuplicates(accountId, [makeRow()]);
    expect(dupes).toHaveLength(0);
  });
});

describe('removeDuplicates', () => {
  it('returns only rows not in the duplicates list', async () => {
    const row1 = makeRow({ description: 'Starbucks', date: '2025-06-01' });
    const row2 = makeRow({ description: 'Netflix', date: '2025-06-05', amount: -15.99 });

    // Simulate row1 being a duplicate
    seedTransaction(db, { account_id: accountId, date: '2025-06-01', description: 'Starbucks', amount: -5.5 });
    const dupes = await findDuplicates(accountId, [row1, row2]);

    const clean = removeDuplicates([row1, row2], dupes);
    expect(clean).not.toContain(row1);
    expect(clean).toContainEqual(row2);
  });

  it('returns all rows when no duplicates', () => {
    const rows = [makeRow(), makeRow({ description: 'Other', date: '2025-06-10' })];
    expect(removeDuplicates(rows, [])).toEqual(rows);
  });
});
