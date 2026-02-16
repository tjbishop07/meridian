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

  // Check for duplicates before inserting
  const duplicates = findDuplicateTransactions(
    data.account_id,
    data.date,
    data.amount,
    data.description
  );

  if (duplicates.length > 0) {
    console.log('[Transactions] Duplicate transaction detected:', {
      incoming: { account_id: data.account_id, date: data.date, amount: data.amount, description: data.description },
      existing: duplicates[0]
    });
    throw new Error('Duplicate transaction: A similar transaction already exists');
  }

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
    let skipped = 0;
    let updated = 0;

    // Reduced logging for cleaner console output

    const updateStmt = db.prepare(`
      UPDATE transactions
      SET category_id = ?,
          amount = ?,
          date = ?,
          description = ?,
          status = ?
      WHERE id = ?
    `);

    for (const txn of txns) {
      // Check for duplicates before inserting
      const duplicates = findDuplicateTransactions(
        txn.account_id,
        txn.date,
        txn.amount,
        txn.description
      );

      if (duplicates.length > 0) {
        const existing = duplicates[0];

        // Check if this is a pending→posted transition
        const isPendingToPosted = !existing.category_id && txn.category_id;

        // Check if any fields differ that would warrant an update
        const needsUpdate =
          (txn.category_id && !existing.category_id) || // Category added
          (txn.category_id && existing.category_id !== txn.category_id) || // Category changed
          Math.abs(existing.amount - txn.amount) > 0.001 || // Amount changed (accounting for float precision)
          existing.date !== txn.date || // Date changed
          existing.description !== txn.description || // Description cleaned up
          existing.status !== (txn.status || 'cleared'); // Status changed

        if (needsUpdate) {
          // Update the existing transaction with the newer data
          updateStmt.run(
            txn.category_id || existing.category_id || null,
            txn.amount,
            txn.date,
            txn.description,
            txn.status || 'cleared',
            existing.id
          );
          updated++;

          if (isPendingToPosted) {
            console.log('[Transactions] Updated pending→posted transaction:', {
              id: existing.id,
              description: `${existing.description} → ${txn.description}`,
              amount: existing.amount !== txn.amount ? `${existing.amount} → ${txn.amount}` : txn.amount,
              category: `none → ${txn.category_id}`
            });
          }
          skipped++;
          continue;
        }

        // No changes needed, just skip
        skipped++;
        continue;
      }

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
        // Skip duplicates (UNIQUE constraint violation - fallback)
        if (!(error as Error).message.includes('UNIQUE constraint')) {
          throw error;
        }
        skipped++;
      }
    }

    if (skipped > 0 || updated > 0) {
      console.log(`[Transactions] Created ${count} new, updated ${updated} existing, skipped ${skipped - updated} unchanged transactions`);
    }

    return count;
  });

  return insertMany(transactions);
}

/**
 * Helper to normalize transaction descriptions for comparison
 * Removes status prefixes and cleans up formatting
 */
function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .trim()
    // Remove common status prefixes
    .replace(/^(pending|processing|posted|cleared|authorized):\s*/i, '')
    .replace(/\s*\(pending\)\s*/i, '')
    .replace(/\s*\(processing\)\s*/i, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching transaction descriptions
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

export function findDuplicateTransactions(
  accountId: number,
  date: string,
  amount: number,
  description: string
): Transaction[] {
  const db = getDatabase();

  // Normalize the incoming description for better matching
  const normalizedDesc = normalizeDescription(description);

  // Step 1: Try exact match first (fastest)
  const exact = db.prepare(`
    SELECT * FROM transactions
    WHERE account_id = ? AND date = ? AND amount = ? AND description = ?
  `).all(accountId, date, amount, description) as Transaction[];

  if (exact.length > 0) {
    console.log('[Transactions] Found exact duplicate match');
    return exact;
  }

  // Step 2: Fuzzy match with date tolerance (±3 days)
  // Use wider amount range to catch pending→posted transitions where tips/fees were added
  const amountTolerance = 2.00; // Allow up to $2 difference (covers most tips/fees)
  const candidates = db.prepare(`
    SELECT * FROM transactions
    WHERE account_id = ?
      AND ABS(amount - ?) <= ?
      AND date BETWEEN date(?, '-3 days') AND date(?, '+3 days')
  `).all(accountId, amount, amountTolerance, date, date) as Transaction[];

  if (candidates.length === 0) {
    return [];
  }

  // Step 3: Filter by description similarity
  const similarTransactions = candidates.filter(txn => {
    const existingDescLower = txn.description.toLowerCase().trim();
    const existingNormalized = normalizeDescription(txn.description);

    // Exact match on normalized descriptions (catches "Pending: Starbucks" → "Starbucks")
    if (normalizedDesc === existingNormalized) {
      console.log('[Transactions] Found normalized duplicate match:', {
        new: description,
        existing: txn.description
      });
      return true;
    }

    // Substring match
    if (existingDescLower.includes(normalizedDesc) || normalizedDesc.includes(existingDescLower)) {
      console.log('[Transactions] Found fuzzy duplicate match (substring):', {
        new: description,
        existing: txn.description
      });
      return true;
    }

    // Prefix match (first 10 chars)
    if (normalizedDesc.length >= 10 && existingNormalized.length >= 10) {
      if (normalizedDesc.substring(0, 10) === existingNormalized.substring(0, 10)) {
        console.log('[Transactions] Found fuzzy duplicate match (prefix):', {
          new: description,
          existing: txn.description
        });
        return true;
      }
    }

    // Levenshtein distance match (for typos, small differences)
    // Allow up to 3 character differences for short descriptions, 5 for longer ones
    const maxDistance = normalizedDesc.length < 15 ? 3 : 5;
    const distance = levenshteinDistance(normalizedDesc, existingNormalized);
    if (distance <= maxDistance) {
      console.log('[Transactions] Found fuzzy duplicate match (Levenshtein distance):', {
        new: description,
        existing: txn.description,
        distance,
        maxDistance
      });
      return true;
    }

    // Special case: If existing transaction has no category (likely pending),
    // be more lenient with description matching
    if (!txn.category_id) {
      // Check if core merchant name is similar (first 5 chars)
      if (normalizedDesc.length >= 5 && existingNormalized.length >= 5) {
        if (normalizedDesc.substring(0, 5) === existingNormalized.substring(0, 5)) {
          console.log('[Transactions] Found fuzzy duplicate match (pending transaction with similar prefix):', {
            new: description,
            existing: txn.description
          });
          return true;
        }
      }
    }

    return false;
  });

  return similarTransactions;
}

export function deleteAllTransactions(): number {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM transactions').run();
  return result.changes;
}
