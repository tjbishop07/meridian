import { getDatabase } from '../index';
import type { Goal, GoalInput, GoalContribution } from '../../../src/types';

export function getAllGoals(includeCompleted: boolean = false): Goal[] {
  const db = getDatabase();

  let sql = `
    SELECT
      g.*,
      c.name as category_name
    FROM goals g
    LEFT JOIN categories c ON g.category_id = c.id
  `;

  if (!includeCompleted) {
    sql += ' WHERE g.is_completed = 0';
  }

  sql += ' ORDER BY g.created_at DESC';

  const goals = db.prepare(sql).all() as Goal[];

  // Calculate progress for each goal
  return goals.map((goal) => {
    const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;

    let days_remaining = null;
    if (goal.target_date) {
      const today = new Date();
      const target = new Date(goal.target_date);
      const diffTime = target.getTime() - today.getTime();
      days_remaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
      ...goal,
      progress,
      days_remaining,
    };
  });
}

export function getGoalById(id: number): Goal | null {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as Goal) || null;
}

export function createGoal(data: GoalInput): Goal {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO goals (name, target_amount, current_amount, target_date, category_id, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    data.name,
    data.target_amount,
    data.current_amount || 0,
    data.target_date || null,
    data.category_id || null,
    data.notes || null
  );

  const goal = getGoalById(result.lastInsertRowid as number);
  if (!goal) {
    throw new Error('Failed to create goal');
  }

  return goal;
}

export function updateGoal(data: Partial<GoalInput> & { id: number }): Goal {
  const db = getDatabase();

  const fields: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    params.push(data.name);
  }

  if (data.target_amount !== undefined) {
    fields.push('target_amount = ?');
    params.push(data.target_amount);
  }

  if (data.current_amount !== undefined) {
    fields.push('current_amount = ?');
    params.push(data.current_amount);
  }

  if (data.target_date !== undefined) {
    fields.push('target_date = ?');
    params.push(data.target_date);
  }

  if (data.category_id !== undefined) {
    fields.push('category_id = ?');
    params.push(data.category_id);
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
    UPDATE goals
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...params);

  const goal = getGoalById(data.id);
  if (!goal) {
    throw new Error('Failed to update goal');
  }

  return goal;
}

export function deleteGoal(id: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM goals WHERE id = ?').run(id);
}

export function addContribution(
  goalId: number,
  amount: number,
  date?: string,
  notes?: string
): GoalContribution {
  const db = getDatabase();

  const transaction = db.transaction(() => {
    // Add contribution record
    const stmt = db.prepare(`
      INSERT INTO goal_contributions (goal_id, amount, date, notes)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(goalId, amount, date || new Date().toISOString().split('T')[0], notes || null);

    // Update goal's current amount
    db.prepare('UPDATE goals SET current_amount = current_amount + ? WHERE id = ?').run(amount, goalId);

    // Check if goal is completed
    const goal = getGoalById(goalId);
    if (goal && goal.current_amount >= goal.target_amount) {
      db.prepare('UPDATE goals SET is_completed = 1 WHERE id = ?').run(goalId);
    }

    return {
      id: result.lastInsertRowid as number,
      goal_id: goalId,
      amount,
      date: date || new Date().toISOString().split('T')[0],
      notes: notes || null,
      created_at: new Date().toISOString(),
    } as GoalContribution;
  });

  return transaction();
}

export function getGoalContributions(goalId: number): GoalContribution[] {
  const db = getDatabase();

  return db
    .prepare('SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY date DESC')
    .all(goalId) as GoalContribution[];
}
