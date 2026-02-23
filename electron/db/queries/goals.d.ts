import type { Goal, GoalInput, GoalContribution } from '../../../src/types';
export declare function getAllGoals(includeCompleted?: boolean): Goal[];
export declare function getGoalById(id: number): Goal | null;
export declare function createGoal(data: GoalInput): Goal;
export declare function updateGoal(data: Partial<GoalInput> & {
    id: number;
}): Goal;
export declare function deleteGoal(id: number): void;
export declare function addContribution(goalId: number, amount: number, date?: string, notes?: string): GoalContribution;
export declare function getGoalContributions(goalId: number): GoalContribution[];
