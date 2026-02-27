import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../../../../setup/db-helpers';

vi.mock('../../../../../electron/db/index', () => ({ getDatabase: vi.fn() }));

import { getDatabase } from '../../../../../electron/db/index';
import {
  createGoal,
  addContribution,
  getGoalById,
} from '../../../../../electron/db/queries/goals';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
  vi.mocked(getDatabase).mockReturnValue(db);
});

describe('addContribution', () => {
  it('increases current_amount by the contributed amount', () => {
    const goal = createGoal({ name: 'Emergency Fund', target_amount: 1000 });
    addContribution(goal.id, 250);

    const updated = getGoalById(goal.id)!;
    expect(updated.current_amount).toBe(250);
  });

  it('auto-completes goal when current_amount reaches target', () => {
    const goal = createGoal({ name: 'Vacation', target_amount: 500 });
    addContribution(goal.id, 500);

    const updated = getGoalById(goal.id)!;
    expect(updated.is_completed).toBeTruthy();
  });

  it('does NOT complete goal when below target', () => {
    const goal = createGoal({ name: 'Car Fund', target_amount: 5000 });
    addContribution(goal.id, 4999);

    const updated = getGoalById(goal.id)!;
    expect(updated.is_completed).toBeFalsy();
  });

  it('handles multiple contributions cumulatively', () => {
    const goal = createGoal({ name: 'House', target_amount: 10000 });
    addContribution(goal.id, 3000);
    addContribution(goal.id, 7000);

    const updated = getGoalById(goal.id)!;
    expect(updated.current_amount).toBe(10000);
    expect(updated.is_completed).toBeTruthy();
  });
});
