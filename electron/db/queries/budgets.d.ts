import type { Budget, BudgetInput } from '../../../src/types';
export declare function getBudgetsByMonth(month: string): Budget[];
export declare function getBudgetById(id: number): Budget | null;
export declare function createBudget(data: BudgetInput): Budget;
export declare function updateBudget(data: Partial<BudgetInput> & {
    id: number;
}): Budget;
export declare function deleteBudget(id: number): void;
export declare function getSpentForCategory(categoryId: number, month: string): number;
export declare function getBudgetProgress(month: string): {
    total_budgeted: number;
    total_spent: number;
    remaining: number;
    percentage: number;
};
export declare function copyBudgetsToNextMonth(fromMonth: string, toMonth: string): number;
