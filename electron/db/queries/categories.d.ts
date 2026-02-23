import type { Category } from '../../../src/types';
export declare function getAllCategories(): Category[];
export declare function getCategoryById(id: number): Category | null;
export declare function getCategoriesByType(type: 'income' | 'expense'): Category[];
export declare function createCategory(data: Omit<Category, 'id' | 'created_at'>): number;
export declare function updateCategory(data: Partial<Category> & {
    id: number;
}): Category;
export declare function deleteCategory(id: number): void;
export declare function deleteAllCategories(): number;
