import { ipcMain } from 'electron';
import * as categoryQueries from '../db/queries/categories';
export function registerCategoryHandlers() {
    ipcMain.handle('categories:get-all', async () => {
        try {
            return categoryQueries.getAllCategories();
        }
        catch (error) {
            console.error('Error getting categories:', error);
            throw error;
        }
    });
    ipcMain.handle('categories:get-tree', async () => {
        try {
            // For now, just return all categories. Can implement tree structure later
            return categoryQueries.getAllCategories();
        }
        catch (error) {
            console.error('Error getting category tree:', error);
            throw error;
        }
    });
    ipcMain.handle('categories:create', async (_, data) => {
        try {
            return categoryQueries.createCategory(data);
        }
        catch (error) {
            console.error('Error creating category:', error);
            throw error;
        }
    });
    ipcMain.handle('categories:update', async (_, data) => {
        try {
            return categoryQueries.updateCategory(data);
        }
        catch (error) {
            console.error('Error updating category:', error);
            throw error;
        }
    });
    ipcMain.handle('categories:delete', async (_, id) => {
        try {
            categoryQueries.deleteCategory(id);
        }
        catch (error) {
            console.error('Error deleting category:', error);
            throw error;
        }
    });
    ipcMain.handle('categories:delete-all', async () => {
        try {
            return categoryQueries.deleteAllCategories();
        }
        catch (error) {
            console.error('Error deleting all categories:', error);
            throw error;
        }
    });
    console.log('Category IPC handlers registered');
}
