import type { MonthlyStats, CategoryBreakdown, SpendingTrend } from '../../../src/types';
export declare function getMonthlyStats(month: string): MonthlyStats;
export declare function getCategoryBreakdown(startDate: string, endDate: string, type: 'income' | 'expense'): CategoryBreakdown[];
export declare function getSpendingTrends(months: number): SpendingTrend[];
export declare function getTopExpenseCategories(month: string, limit?: number): CategoryBreakdown[];
export declare function getRecentTransactions(limit?: number): unknown[];
export declare function getTotalsByType(): {
    income: number;
    expenses: number;
    net: number;
};
export declare function getTopTransactionsByMonth(month: string, limit?: number): unknown[];
export declare function getDailySpendingForMonth(month: string): Array<{
    date: string;
    expenses: number;
}>;
export declare function getDailySpending(days?: number): Array<{
    date: string;
    amount: number;
    count: number;
}>;
