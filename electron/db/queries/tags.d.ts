import type { Tag, TagStat, TagMonthlyRow } from '../../../src/types';
import type { Transaction } from '../../../src/types';
export declare function getAllTags(): Tag[];
export declare function getTagsForTransaction(transactionId: number): Tag[];
export declare function getTagStats(): TagStat[];
export declare function createTag(data: {
    name: string;
    color: string;
    description?: string;
}): number;
export declare function updateTag(data: {
    id: number;
    name?: string;
    color?: string;
    description?: string;
}): Tag;
export declare function getTagMonthlyStats(months?: number): TagMonthlyRow[];
export declare function deleteTag(id: number): void;
export declare function setTagsForTransaction(transactionId: number, tagIds: number[]): void;
export declare function getTransactionsForTag(tagId: number): Transaction[];
export declare function getAllTransactionTags(): Array<{
    transaction_id: number;
    tag_id: number;
    tag_name: string;
    tag_color: string;
}>;
