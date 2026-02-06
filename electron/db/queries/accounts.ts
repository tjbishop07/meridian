import { getDatabase } from '../index';
import type { Account } from '../../../src/types';

export function getAllAccounts(): Account[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM accounts ORDER BY name').all() as Account[];
}

export function getAccountById(id: number): Account | null {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account) || null;
}

export function createAccount(
  data: Omit<Account, 'id' | 'created_at' | 'updated_at'>
): Account {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO accounts (name, type, institution, balance, currency, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    data.name,
    data.type,
    data.institution,
    data.balance,
    data.currency,
    data.is_active ? 1 : 0
  );

  const account = getAccountById(result.lastInsertRowid as number);
  if (!account) {
    throw new Error('Failed to create account');
  }

  return account;
}

export function updateAccount(data: Partial<Account> & { id: number }): Account {
  const db = getDatabase();

  const fields: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    params.push(data.name);
  }

  if (data.type !== undefined) {
    fields.push('type = ?');
    params.push(data.type);
  }

  if (data.institution !== undefined) {
    fields.push('institution = ?');
    params.push(data.institution);
  }

  if (data.balance !== undefined) {
    fields.push('balance = ?');
    params.push(data.balance);
  }

  if (data.currency !== undefined) {
    fields.push('currency = ?');
    params.push(data.currency);
  }

  if (data.is_active !== undefined) {
    fields.push('is_active = ?');
    params.push(data.is_active ? 1 : 0);
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  params.push(data.id);

  const stmt = db.prepare(`
    UPDATE accounts
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...params);

  const account = getAccountById(data.id);
  if (!account) {
    throw new Error('Failed to update account');
  }

  return account;
}

export function deleteAccount(id: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
}

export function updateAccountBalance(accountId: number): void {
  const db = getDatabase();

  // Calculate balance from transactions
  const result = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance
    FROM transactions
    WHERE account_id = ?
  `).get(accountId) as { balance: number };

  db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(
    result.balance,
    accountId
  );
}
