import type { Transaction, ParsedCSVRow } from '../../src/types';
export interface DuplicateMatch {
    csvRow: ParsedCSVRow;
    existingTransaction: Transaction;
    matchType: 'exact' | 'fuzzy';
    confidence: number;
}
export declare function findDuplicates(accountId: number, rows: ParsedCSVRow[]): Promise<DuplicateMatch[]>;
export declare function removeDuplicates(rows: ParsedCSVRow[], duplicates: DuplicateMatch[]): ParsedCSVRow[];
