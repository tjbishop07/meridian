import { getDatabase } from '../index';

export interface ReceiptItem {
  name: string;
  amount: number;
  category_id: number | null;
  category_name: string | null;
}

export interface ReceiptData {
  merchant: string | null;
  date: string | null;
  total: number | null;
  tax: number | null;
  items: ReceiptItem[];
}

export interface ReceiptRow {
  id: number;
  transaction_id: number | null;
  file_path: string;
  file_name: string;
  extracted_data: string | null;
  ai_model: string | null;
  created_at: string;
}

export interface CreateReceiptInput {
  transaction_id?: number | null;
  file_path: string;
  file_name: string;
  extracted_data?: ReceiptData | null;
  ai_model?: string | null;
}

export function createReceipt(data: CreateReceiptInput): ReceiptRow {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO receipts (transaction_id, file_path, file_name, extracted_data, ai_model)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    data.transaction_id ?? null,
    data.file_path,
    data.file_name,
    data.extracted_data ? JSON.stringify(data.extracted_data) : null,
    data.ai_model ?? null
  );
  return getReceiptById(result.lastInsertRowid as number)!;
}

export function getReceiptById(id: number): ReceiptRow | null {
  const db = getDatabase();
  return db.prepare('SELECT * FROM receipts WHERE id = ?').get(id) as ReceiptRow | null;
}

export function getReceiptByTransactionId(transactionId: number): ReceiptRow | null {
  const db = getDatabase();
  return db.prepare('SELECT * FROM receipts WHERE transaction_id = ? LIMIT 1').get(transactionId) as ReceiptRow | null;
}

export function updateReceiptExtractedData(receiptId: number, extractedData: ReceiptData, aiModel: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE receipts SET extracted_data = ?, ai_model = ? WHERE id = ?
  `).run(JSON.stringify(extractedData), aiModel, receiptId);
}

export function updateReceiptTransaction(receiptId: number, transactionId: number | null): void {
  const db = getDatabase();
  db.prepare('UPDATE receipts SET transaction_id = ? WHERE id = ?').run(transactionId, receiptId);
}

export function deleteReceipt(receiptId: number): ReceiptRow | null {
  const db = getDatabase();
  const row = getReceiptById(receiptId);
  if (row) {
    db.prepare('DELETE FROM receipts WHERE id = ?').run(receiptId);
  }
  return row;
}
