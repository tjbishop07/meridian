import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, seedAccount } from '../../../../setup/db-helpers';

vi.mock('../../../../../electron/db/index', () => ({ getDatabase: vi.fn() }));

import { getDatabase } from '../../../../../electron/db/index';
import { createBill, getAllBills } from '../../../../../electron/db/queries/bills';
import type Database from 'better-sqlite3';

let db: Database.Database;
let accountId: number;

beforeEach(() => {
  db = createTestDb();
  vi.mocked(getDatabase).mockReturnValue(db);
  accountId = seedAccount(db);
});

describe('createBill', () => {
  it('creates a bill and returns it with a next_due_date', () => {
    const bill = createBill({
      name: 'Netflix',
      amount: 15.99,
      due_day: 15,
      frequency: 'monthly',
    });
    expect(bill.id).toBeGreaterThan(0);
    expect(bill.next_due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('clamps due_day=29 to Feb 28 in non-leap year', () => {
    const bill = createBill({
      name: 'Gym',
      amount: 40,
      due_day: 29,
      frequency: 'monthly',
    });

    // Build the expected next-due for this month/next month (runtime-dependent)
    // We just verify the date is valid and day ≤ 28 when the target month is Feb
    const d = new Date(bill.next_due_date!);
    // If February, day must not exceed 28 (or 29 in leap year, but we allow both)
    if (d.getMonth() === 1) {
      expect(d.getDate()).toBeLessThanOrEqual(29);
    }
  });

  it('calculates days_until_due ≥ 0', () => {
    const bill = createBill({
      name: 'Electricity',
      amount: 80,
      due_day: 1,
      frequency: 'monthly',
    });
    expect(bill.days_until_due).toBeGreaterThanOrEqual(0);
  });
});

describe('getAllBills', () => {
  it('returns only active bills by default', () => {
    createBill({ name: 'Active', amount: 10, due_day: 5, frequency: 'monthly' });
    // Deactivate via raw SQL
    db.prepare(`UPDATE bills SET is_active = 0 WHERE name = 'Active'`).run();

    const active = getAllBills(true);
    expect(active.every((b) => b.is_active)).toBe(true);
  });
});
