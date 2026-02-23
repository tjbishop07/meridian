import { getDatabase } from '../index';
export function getAllBills(activeOnly = true) {
    const db = getDatabase();
    let sql = `
    SELECT
      b.*,
      c.name as category_name,
      a.name as account_name
    FROM bills b
    LEFT JOIN categories c ON b.category_id = c.id
    LEFT JOIN accounts a ON b.account_id = a.id
  `;
    if (activeOnly) {
        sql += ' WHERE b.is_active = 1';
    }
    sql += ' ORDER BY b.due_day ASC';
    const bills = db.prepare(sql).all();
    return bills.map((bill) => {
        const { next_due_date, days_until_due } = calculateNextDueDate(bill);
        return {
            ...bill,
            next_due_date,
            days_until_due,
        };
    });
}
function calculateNextDueDate(bill) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();
    let nextDue;
    if (bill.frequency === 'monthly') {
        // If the due day hasn't passed this month, it's this month
        const dueDay = Math.min(bill.due_day, new Date(currentYear, currentMonth + 1, 0).getDate());
        if (currentDay <= dueDay) {
            nextDue = new Date(currentYear, currentMonth, dueDay);
        }
        else {
            // Next month
            const nextMonth = currentMonth + 1;
            const maxDay = new Date(currentYear, nextMonth + 1, 0).getDate();
            nextDue = new Date(currentYear, nextMonth, Math.min(bill.due_day, maxDay));
        }
    }
    else if (bill.frequency === 'quarterly') {
        // Find the next quarter month (0, 3, 6, 9) that has this due day in the future
        const quarterMonths = [0, 3, 6, 9];
        nextDue = new Date(currentYear + 1, 0, bill.due_day); // fallback: next year
        for (const qMonth of quarterMonths) {
            const maxDay = new Date(currentYear, qMonth + 1, 0).getDate();
            const candidate = new Date(currentYear, qMonth, Math.min(bill.due_day, maxDay));
            if (candidate >= today) {
                nextDue = candidate;
                break;
            }
        }
    }
    else {
        // Yearly - same day this year or next
        const maxDay = new Date(currentYear, currentMonth + 1, 0).getDate();
        const thisYear = new Date(currentYear, currentMonth, Math.min(bill.due_day, maxDay));
        if (thisYear >= today) {
            nextDue = thisYear;
        }
        else {
            nextDue = new Date(currentYear + 1, currentMonth, Math.min(bill.due_day, maxDay));
        }
    }
    const diffTime = nextDue.getTime() - today.getTime();
    const days_until_due = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
        next_due_date: nextDue.toISOString().split('T')[0],
        days_until_due,
    };
}
export function getUpcomingBills(days = 30) {
    const bills = getAllBills(true);
    return bills.filter((bill) => bill.days_until_due >= 0 && bill.days_until_due <= days);
}
export function getBillById(id) {
    const db = getDatabase();
    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(id);
    if (!bill)
        return null;
    const { next_due_date, days_until_due } = calculateNextDueDate(bill);
    return { ...bill, next_due_date, days_until_due };
}
export function createBill(data) {
    const db = getDatabase();
    const stmt = db.prepare(`
    INSERT INTO bills (name, amount, category_id, due_day, frequency, account_id, is_autopay, reminder_days, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const result = stmt.run(data.name, data.amount, data.category_id || null, data.due_day, data.frequency, data.account_id || null, data.is_autopay ? 1 : 0, data.reminder_days || 3, data.notes || null);
    const bill = getBillById(result.lastInsertRowid);
    if (!bill) {
        throw new Error('Failed to create bill');
    }
    return bill;
}
export function updateBill(data) {
    const db = getDatabase();
    const fields = [];
    const params = [];
    if (data.name !== undefined) {
        fields.push('name = ?');
        params.push(data.name);
    }
    if (data.amount !== undefined) {
        fields.push('amount = ?');
        params.push(data.amount);
    }
    if (data.category_id !== undefined) {
        fields.push('category_id = ?');
        params.push(data.category_id);
    }
    if (data.due_day !== undefined) {
        fields.push('due_day = ?');
        params.push(data.due_day);
    }
    if (data.frequency !== undefined) {
        fields.push('frequency = ?');
        params.push(data.frequency);
    }
    if (data.account_id !== undefined) {
        fields.push('account_id = ?');
        params.push(data.account_id);
    }
    if (data.is_autopay !== undefined) {
        fields.push('is_autopay = ?');
        params.push(data.is_autopay ? 1 : 0);
    }
    if (data.reminder_days !== undefined) {
        fields.push('reminder_days = ?');
        params.push(data.reminder_days);
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
    UPDATE bills
    SET ${fields.join(', ')}
    WHERE id = ?
  `);
    stmt.run(...params);
    const bill = getBillById(data.id);
    if (!bill) {
        throw new Error('Failed to update bill');
    }
    return bill;
}
export function deleteBill(id) {
    const db = getDatabase();
    db.prepare('DELETE FROM bills WHERE id = ?').run(id);
}
export function recordPayment(billId, amount, date, transactionId, notes) {
    const db = getDatabase();
    const stmt = db.prepare(`
    INSERT INTO bill_payments (bill_id, transaction_id, date, amount, notes)
    VALUES (?, ?, ?, ?, ?)
  `);
    const result = stmt.run(billId, transactionId || null, date || new Date().toISOString().split('T')[0], amount, notes || null);
    return {
        id: result.lastInsertRowid,
        bill_id: billId,
        transaction_id: transactionId || null,
        date: date || new Date().toISOString().split('T')[0],
        amount,
        notes: notes || null,
        created_at: new Date().toISOString(),
    };
}
export function getBillPayments(billId) {
    const db = getDatabase();
    return db
        .prepare('SELECT * FROM bill_payments WHERE bill_id = ? ORDER BY date DESC')
        .all(billId);
}
