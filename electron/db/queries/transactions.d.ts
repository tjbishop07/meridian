import type { Transaction, TransactionFilters, CreateTransactionInput, UpdateTransactionInput } from '../../../src/types';
export declare function getAllTransactions(filters?: TransactionFilters): Transaction[];
export declare function getTransactionById(id: number): Transaction | null;
export declare function createTransaction(data: CreateTransactionInput): Transaction;
export declare function updateTransaction(data: UpdateTransactionInput): Transaction;
export declare function deleteTransaction(id: number): void;
export declare function bulkCreateTransactions(transactions: CreateTransactionInput[]): number;
export declare function findDuplicateTransactions(accountId: number, date: string, amount: number, description: string): Transaction[];
export declare function deleteAllTransactions(): number;
