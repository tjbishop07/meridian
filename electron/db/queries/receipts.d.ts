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
export declare function createReceipt(data: CreateReceiptInput): ReceiptRow;
export declare function getReceiptById(id: number): ReceiptRow | null;
export declare function getReceiptByTransactionId(transactionId: number): ReceiptRow | null;
export declare function updateReceiptExtractedData(receiptId: number, extractedData: ReceiptData, aiModel: string): void;
export declare function updateReceiptTransaction(receiptId: number, transactionId: number | null): void;
export declare function deleteReceipt(receiptId: number): ReceiptRow | null;
