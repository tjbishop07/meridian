import type { Account } from '../../../src/types';
export declare function getAllAccounts(): Account[];
export declare function getAccountById(id: number): Account | null;
export declare function createAccount(data: Omit<Account, 'id' | 'created_at' | 'updated_at'>): Account;
export declare function updateAccount(data: Partial<Account> & {
    id: number;
}): Account;
export declare function deleteAccount(id: number): void;
export declare function updateAccountBalance(accountId: number): void;
