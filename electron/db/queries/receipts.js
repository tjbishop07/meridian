import { getDatabase } from '../index';
export function createReceipt(data) {
    const db = getDatabase();
    const result = db.prepare(`
    INSERT INTO receipts (transaction_id, file_path, file_name, extracted_data, ai_model)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.transaction_id ?? null, data.file_path, data.file_name, data.extracted_data ? JSON.stringify(data.extracted_data) : null, data.ai_model ?? null);
    return getReceiptById(result.lastInsertRowid);
}
export function getReceiptById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM receipts WHERE id = ?').get(id);
}
export function getReceiptByTransactionId(transactionId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM receipts WHERE transaction_id = ? LIMIT 1').get(transactionId);
}
export function updateReceiptExtractedData(receiptId, extractedData, aiModel) {
    const db = getDatabase();
    db.prepare(`
    UPDATE receipts SET extracted_data = ?, ai_model = ? WHERE id = ?
  `).run(JSON.stringify(extractedData), aiModel, receiptId);
}
export function updateReceiptTransaction(receiptId, transactionId) {
    const db = getDatabase();
    db.prepare('UPDATE receipts SET transaction_id = ? WHERE id = ?').run(transactionId, receiptId);
}
export function deleteReceipt(receiptId) {
    const db = getDatabase();
    const row = getReceiptById(receiptId);
    if (row) {
        db.prepare('DELETE FROM receipts WHERE id = ?').run(receiptId);
    }
    return row;
}
