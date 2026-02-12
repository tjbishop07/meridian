import { getDatabase } from '../index';
import type {
  Transaction,
  TransactionFilters,
  CreateTransactionInput,
  UpdateTransactionInput
} from '../../../src/types';

export function getAllTransactions(filters: TransactionFilters = {}): Transaction[] {
  const db = getDatabase();

  let sql = `
    SELECT
      t.*,
      a.name as account_name,
      c.name as category_name,
      linked_a.name as linked_account_name
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN transactions linked_t ON t.linked_transaction_id = linked_t.id
    LEFT JOIN accounts linked_a ON linked_t.account_id = linked_a.id
    WHERE 1=1
  `;

  const params: any[] = [];

  if (filters.account_id) {
    sql += ' AND t.account_id = ?';
    params.push(filters.account_id);
  }

  if (filters.category_id) {
    sql += ' AND t.category_id = ?';
    params.push(filters.category_id);
  }

  if (filters.type) {
    sql += ' AND t.type = ?';
    params.push(filters.type);
  }

  if (filters.status) {
    sql += ' AND t.status = ?';
    params.push(filters.status);
  }

  if (filters.start_date) {
    sql += ' AND t.date >= ?';
    params.push(filters.start_date);
  }

  if (filters.end_date) {
    sql += ' AND t.date <= ?';
    params.push(filters.end_date);
  }

  if (filters.search) {
    sql += ' AND (t.description LIKE ? OR t.original_description LIKE ?)';
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm);
  }

  sql += ' ORDER BY t.date DESC, t.id DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  if (filters.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  return db.prepare(sql).all(...params) as Transaction[];
}

export function getTransactionById(id: number): Transaction | null {
  const db = getDatabase();

  const sql = `
    SELECT
      t.*,
      a.name as account_name,
      c.name as category_name,
      linked_a.name as linked_account_name
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN transactions linked_t ON t.linked_transaction_id = linked_t.id
    LEFT JOIN accounts linked_a ON linked_t.account_id = linked_a.id
    WHERE t.id = ?
  `;

  return (db.prepare(sql).get(id) as Transaction) || null;
}

export function createTransaction(data: CreateTransactionInput): Transaction {
  const db = getDatabase();

  // Handle transfers specially - create two linked transactions
  if (data.type === 'transfer') {
    if (!data.to_account_id) {
      throw new Error('to_account_id is required for transfers');
    }

    return db.transaction(() => {
      // Create the outgoing transaction (debit from source account)
      const stmt1 = db.prepare(`
        INSERT INTO transactions (
          account_id, date, description, original_description,
          amount, type, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result1 = stmt1.run(
        data.account_id,
        data.date,
        data.description,
        data.original_description || null,
        data.amount,
        'transfer',
        data.status || 'cleared',
        data.notes || null
      );

      const outgoingId = result1.lastInsertRowid as number;

      // Create the incoming transaction (credit to destination account)
      // Use slightly different description to avoid UNIQUE constraint
      const linkedDescription = `${data.description} (transfer)`;

      const stmt2 = db.prepare(`
        INSERT INTO transactions (
          account_id, date, description, original_description,
          amount, type, status, notes, linked_transaction_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result2 = stmt2.run(
        data.to_account_id,
        data.date,
        linkedDescription,
        data.original_description || null,
        data.amount,
        'transfer',
        data.status || 'cleared',
        data.notes || null,
        outgoingId
      );

      const incomingId = result2.lastInsertRowid as number;

      // Update the outgoing transaction with the linked_transaction_id
      db.prepare('UPDATE transactions SET linked_transaction_id = ? WHERE id = ?')
        .run(incomingId, outgoingId);

      // Return the outgoing transaction
      const transaction = getTransactionById(outgoingId);
      if (!transaction) {
        throw new Error('Failed to create transfer transaction');
      }

      return transaction;
    })();
  }

  // Regular income/expense transaction
  const stmt = db.prepare(`
    INSERT INTO transactions (
      account_id, category_id, date, description, original_description,
      amount, type, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    data.account_id,
    data.category_id || null,
    data.date,
    data.description,
    data.original_description || null,
    data.amount,
    data.type,
    data.status || 'cleared',
    data.notes || null
  );

  const transaction = getTransactionById(result.lastInsertRowid as number);
  if (!transaction) {
    throw new Error('Failed to create transaction');
  }

  return transaction;
}

export function updateTransaction(data: UpdateTransactionInput): Transaction {
  const db = getDatabase();

  // Check if converting to/from transfer
  const currentTransaction = getTransactionById(data.id);
  if (!currentTransaction) {
    throw new Error('Transaction not found');
  }

  // Handle conversion to transfer type
  if (data.type === 'transfer' && currentTransaction.type !== 'transfer') {
    if (!data.to_account_id) {
      throw new Error('to_account_id is required when converting to transfer');
    }

    return db.transaction(() => {
      // Delete the old transaction's linked transaction if it exists
      if (currentTransaction.linked_transaction_id) {
        db.prepare('DELETE FROM transactions WHERE id = ?').run(currentTransaction.linked_transaction_id);
      }

      // Build update fields for the existing transaction
      const fields: string[] = ['type = ?', 'category_id = NULL'];
      const params: any[] = ['transfer'];

      if (data.account_id !== undefined) {
        fields.push('account_id = ?');
        params.push(data.account_id);
      }

      if (data.description !== undefined) {
        fields.push('description = ?');
        params.push(data.description);
      }

      if (data.amount !== undefined) {
        fields.push('amount = ?');
        params.push(data.amount);
      }

      if (data.date !== undefined) {
        fields.push('date = ?');
        params.push(data.date);
      }

      if (data.status !== undefined) {
        fields.push('status = ?');
        params.push(data.status);
      }

      if (data.notes !== undefined) {
        fields.push('notes = ?');
        params.push(data.notes);
      }

      params.push(data.id);

      // Update the existing transaction
      db.prepare(`
        UPDATE transactions
        SET ${fields.join(', ')}
        WHERE id = ?
      `).run(...params);

      // Create the linked transaction in the destination account
      // Use slightly different description to avoid UNIQUE constraint
      const description = data.description || currentTransaction.description;
      const linkedDescription = `${description} (transfer)`;

      const stmt = db.prepare(`
        INSERT INTO transactions (
          account_id, date, description, original_description,
          amount, type, status, notes, linked_transaction_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        data.to_account_id,
        data.date || currentTransaction.date,
        linkedDescription,
        currentTransaction.original_description,
        data.amount || currentTransaction.amount,
        'transfer',
        data.status || currentTransaction.status,
        data.notes !== undefined ? data.notes : currentTransaction.notes,
        data.id
      );

      const linkedId = result.lastInsertRowid as number;

      // Link them together
      db.prepare('UPDATE transactions SET linked_transaction_id = ? WHERE id = ?')
        .run(linkedId, data.id);

      const transaction = getTransactionById(data.id);
      if (!transaction) {
        throw new Error('Failed to update transaction');
      }
      return transaction;
    })();
  }

  // Handle conversion from transfer to income/expense
  if (data.type && data.type !== 'transfer' && currentTransaction.type === 'transfer') {
    return db.transaction(() => {
      // Delete the linked transaction
      if (currentTransaction.linked_transaction_id) {
        db.prepare('DELETE FROM transactions WHERE id = ?').run(currentTransaction.linked_transaction_id);
      }

      // Update the transaction
      const fields: string[] = ['type = ?', 'linked_transaction_id = NULL'];
      const params: any[] = [data.type];

      if (data.category_id !== undefined) {
        fields.push('category_id = ?');
        params.push(data.category_id);
      }

      if (data.account_id !== undefined) {
        fields.push('account_id = ?');
        params.push(data.account_id);
      }

      if (data.description !== undefined) {
        fields.push('description = ?');
        params.push(data.description);
      }

      if (data.amount !== undefined) {
        fields.push('amount = ?');
        params.push(data.amount);
      }

      if (data.date !== undefined) {
        fields.push('date = ?');
        params.push(data.date);
      }

      if (data.status !== undefined) {
        fields.push('status = ?');
        params.push(data.status);
      }

      if (data.notes !== undefined) {
        fields.push('notes = ?');
        params.push(data.notes);
      }

      params.push(data.id);

      db.prepare(`
        UPDATE transactions
        SET ${fields.join(', ')}
        WHERE id = ?
      `).run(...params);

      const transaction = getTransactionById(data.id);
      if (!transaction) {
        throw new Error('Failed to update transaction');
      }
      return transaction;
    })();
  }

  // Regular update (no type change or staying as transfer)
  const fields: string[] = [];
  const params: any[] = [];

  if (data.category_id !== undefined) {
    fields.push('category_id = ?');
    params.push(data.category_id);
  }

  if (data.account_id !== undefined) {
    fields.push('account_id = ?');
    params.push(data.account_id);
  }

  if (data.description !== undefined) {
    fields.push('description = ?');
    params.push(data.description);
  }

  if (data.amount !== undefined) {
    fields.push('amount = ?');
    params.push(data.amount);

    // If this is a transfer, update the linked transaction's amount too
    if (currentTransaction.type === 'transfer' && currentTransaction.linked_transaction_id) {
      db.prepare('UPDATE transactions SET amount = ? WHERE id = ?')
        .run(data.amount, currentTransaction.linked_transaction_id);
    }
  }

  if (data.date !== undefined) {
    fields.push('date = ?');
    params.push(data.date);

    // If this is a transfer, update the linked transaction's date too
    if (currentTransaction.type === 'transfer' && currentTransaction.linked_transaction_id) {
      db.prepare('UPDATE transactions SET date = ? WHERE id = ?')
        .run(data.date, currentTransaction.linked_transaction_id);
    }
  }

  if (data.status !== undefined) {
    fields.push('status = ?');
    params.push(data.status);

    // If this is a transfer, update the linked transaction's status too
    if (currentTransaction.type === 'transfer' && currentTransaction.linked_transaction_id) {
      db.prepare('UPDATE transactions SET status = ? WHERE id = ?')
        .run(data.status, currentTransaction.linked_transaction_id);
    }
  }

  if (data.notes !== undefined) {
    fields.push('notes = ?');
    params.push(data.notes);

    // If this is a transfer, update the linked transaction's notes too
    if (currentTransaction.type === 'transfer' && currentTransaction.linked_transaction_id) {
      db.prepare('UPDATE transactions SET notes = ? WHERE id = ?')
        .run(data.notes, currentTransaction.linked_transaction_id);
    }
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  params.push(data.id);

  const stmt = db.prepare(`
    UPDATE transactions
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...params);

  const transaction = getTransactionById(data.id);
  if (!transaction) {
    throw new Error('Failed to update transaction');
  }

  return transaction;
}

export function deleteTransaction(id: number): void {
  const db = getDatabase();

  // Check if this is a transfer transaction
  const transaction = getTransactionById(id);
  if (transaction && transaction.type === 'transfer' && transaction.linked_transaction_id) {
    // Delete both linked transactions
    db.transaction(() => {
      db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
      db.prepare('DELETE FROM transactions WHERE id = ?').run(transaction.linked_transaction_id);
    })();
  } else {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  }
}

export function bulkCreateTransactions(transactions: CreateTransactionInput[]): number {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO transactions (
      account_id, category_id, date, description, original_description,
      amount, type, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((txns: CreateTransactionInput[]) => {
    let count = 0;
    for (const txn of txns) {
      try {
        stmt.run(
          txn.account_id,
          txn.category_id || null,
          txn.date,
          txn.description,
          txn.original_description || null,
          txn.amount,
          txn.type,
          txn.status || 'cleared',
          txn.notes || null
        );
        count++;
      } catch (error) {
        // Skip duplicates (UNIQUE constraint violation)
        if (!(error as Error).message.includes('UNIQUE constraint')) {
          throw error;
        }
      }
    }
    return count;
  });

  return insertMany(transactions);
}

export function findDuplicateTransactions(
  accountId: number,
  date: string,
  amount: number,
  description: string
): Transaction[] {
  const db = getDatabase();

  // Exact match
  const exact = db.prepare(`
    SELECT * FROM transactions
    WHERE account_id = ? AND date = ? AND amount = ? AND description = ?
  `).all(accountId, date, amount, description) as Transaction[];

  if (exact.length > 0) {
    return exact;
  }

  // Fuzzy match: same account, amount, and date within ±3 days
  const fuzzy = db.prepare(`
    SELECT * FROM transactions
    WHERE account_id = ?
      AND amount = ?
      AND date BETWEEN date(?, '-3 days') AND date(?, '+3 days')
  `).all(accountId, amount, date, date) as Transaction[];

  return fuzzy;
}

export function deleteAllTransactions(): number {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM transactions').run();
  return result.changes;
}
