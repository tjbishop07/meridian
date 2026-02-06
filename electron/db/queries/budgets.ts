import { getDatabase } from '../index';
import type { Budget, BudgetInput } from '../../../src/types';

export function getBudgetsByMonth(month: string): Budget[] {
  const db = getDatabase();

  const budgets = db
    .prepare(
      `
    SELECT
      b.*,
      c.name as category_name
    FROM budgets b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.month = ?
    ORDER BY c.name
  `
    )
    .all(month) as Budget[];

  // Calculate spent amount for each budget
  return budgets.map((budget) => {
    const spent = getSpentForCategory(budget.category_id, month);
    return {
      ...budget,
      spent,
      remaining: budget.amount - spent,
    };
  });
}

export function getBudgetById(id: number): Budget | null {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM budgets WHERE id = ?').get(id) as Budget) || null;
}

export function createBudget(data: BudgetInput): Budget {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO budgets (category_id, month, amount, rollover, notes)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    data.category_id,
    data.month,
    data.amount,
    data.rollover ? 1 : 0,
    data.notes || null
  );

  const budget = getBudgetById(result.lastInsertRowid as number);
  if (!budget) {
    throw new Error('Failed to create budget');
  }

  return budget;
}

export function updateBudget(data: Partial<BudgetInput> & { id: number }): Budget {
  const db = getDatabase();

  const fields: string[] = [];
  const params: any[] = [];

  if (data.category_id !== undefined) {
    fields.push('category_id = ?');
    params.push(data.category_id);
  }

  if (data.month !== undefined) {
    fields.push('month = ?');
    params.push(data.month);
  }

  if (data.amount !== undefined) {
    fields.push('amount = ?');
    params.push(data.amount);
  }

  if (data.rollover !== undefined) {
    fields.push('rollover = ?');
    params.push(data.rollover ? 1 : 0);
  }

  if (data.notes !== undefined) {
    fields.push('notes = ?');
    params.push(data.notes);
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  params.push(data.id);

  const stmt = db.prepare(`
    UPDATE budgets
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...params);

  const budget = getBudgetById(data.id);
  if (!budget) {
    throw new Error('Failed to update budget');
  }

  return budget;
}

export function deleteBudget(id: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM budgets WHERE id = ?').run(id);
}

export function getSpentForCategory(categoryId: number, month: string): number {
  const db = getDatabase();

  const result = db
    .prepare(
      `
    SELECT COALESCE(SUM(amount), 0) as spent
    FROM transactions
    WHERE category_id = ?
      AND type = 'expense'
      AND strftime('%Y-%m', date) = ?
  `
    )
    .get(categoryId, month) as { spent: number };

  return result.spent;
}

export function getBudgetProgress(month: string): {
  total_budgeted: number;
  total_spent: number;
  remaining: number;
  percentage: number;
} {
  const db = getDatabase();

  const budgetTotal = db
    .prepare(
      `
    SELECT COALESCE(SUM(amount), 0) as total
    FROM budgets
    WHERE month = ?
  `
    )
    .get(month) as { total: number };

  const spentTotal = db
    .prepare(
      `
    SELECT COALESCE(SUM(t.amount), 0) as total
    FROM transactions t
    INNER JOIN budgets b ON t.category_id = b.category_id AND strftime('%Y-%m', t.date) = b.month
    WHERE t.type = 'expense'
      AND b.month = ?
  `
    )
    .get(month) as { total: number };

  const remaining = budgetTotal.total - spentTotal.total;
  const percentage = budgetTotal.total > 0 ? (spentTotal.total / budgetTotal.total) * 100 : 0;

  return {
    total_budgeted: budgetTotal.total,
    total_spent: spentTotal.total,
    remaining,
    percentage,
  };
}

export function copyBudgetsToNextMonth(fromMonth: string, toMonth: string): number {
  const db = getDatabase();

  const budgets = db
    .prepare('SELECT category_id, amount, rollover, notes FROM budgets WHERE month = ?')
    .all(fromMonth);

  if (budgets.length === 0) {
    return 0;
  }

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO budgets (category_id, month, amount, rollover, notes)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: any[]) => {
    let count = 0;
    for (const budget of items) {
      const result = stmt.run(
        budget.category_id,
        toMonth,
        budget.amount,
        budget.rollover,
        budget.notes
      );
      if (result.changes > 0) count++;
    }
    return count;
  });

  return insertMany(budgets);
}
