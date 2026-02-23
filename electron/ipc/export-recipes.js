import { ipcMain } from 'electron';
import { exportRecipeQueries } from '../db/queries/export-recipes';
export function registerExportRecipeHandlers() {
    // Get all export recipes
    ipcMain.handle('export-recipes:get-all', async () => {
        try {
            const recipes = exportRecipeQueries.getAll();
            // Parse steps JSON for each recipe
            return recipes.map(recipe => ({
                ...recipe,
                steps: JSON.parse(recipe.steps),
            }));
        }
        catch (error) {
            console.error('[ExportRecipes] Error getting all recipes:', error);
            throw error;
        }
    });
    // Get recipe by ID
    ipcMain.handle('export-recipes:get-by-id', async (_, id) => {
        try {
            const recipe = exportRecipeQueries.getById(id);
            if (!recipe)
                return null;
            return {
                ...recipe,
                steps: JSON.parse(recipe.steps),
            };
        }
        catch (error) {
            console.error('[ExportRecipes] Error getting recipe:', error);
            throw error;
        }
    });
    // Create new recipe
    ipcMain.handle('export-recipes:create', async (_, input) => {
        try {
            const id = exportRecipeQueries.create(input);
            return { success: true, id };
        }
        catch (error) {
            console.error('[ExportRecipes] Error creating recipe:', error);
            throw error;
        }
    });
    // Update recipe
    ipcMain.handle('export-recipes:update', async (_, data) => {
        try {
            const id = typeof data.id === 'string' ? parseInt(data.id) : data.id;
            const input = {};
            if (data.name !== undefined)
                input.name = data.name;
            if (data.institution !== undefined)
                input.institution = data.institution || undefined;
            if (data.steps !== undefined)
                input.steps = data.steps;
            if (data.account_id !== undefined)
                input.account_id = data.account_id;
            exportRecipeQueries.update(id, input);
            return { success: true };
        }
        catch (error) {
            console.error('[ExportRecipes] Error updating recipe:', error);
            throw error;
        }
    });
    // Delete recipe
    ipcMain.handle('export-recipes:delete', async (_, id) => {
        try {
            exportRecipeQueries.delete(id);
            return { success: true };
        }
        catch (error) {
            console.error('[ExportRecipes] Error deleting recipe:', error);
            throw error;
        }
    });
    console.log('Export recipe IPC handlers registered');
}
