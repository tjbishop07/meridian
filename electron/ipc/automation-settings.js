import { ipcMain } from 'electron';
import { getDatabase } from '../db';
import { getAutomationSettings, getAutomationSetting, setAutomationSetting, updateAutomationSettings, } from '../db/queries/automation-settings';
export function registerAutomationSettingsHandlers() {
    // Get all automation settings
    ipcMain.handle('automation-settings:get-all', async () => {
        const db = getDatabase();
        return getAutomationSettings(db);
    });
    // Get a single setting
    ipcMain.handle('automation-settings:get', async (_event, key) => {
        const db = getDatabase();
        return getAutomationSetting(db, key);
    });
    // Set a single setting
    ipcMain.handle('automation-settings:set', async (_event, key, value) => {
        const db = getDatabase();
        setAutomationSetting(db, key, value);
    });
    // Update multiple settings
    ipcMain.handle('automation-settings:update', async (_event, settings) => {
        const db = getDatabase();
        updateAutomationSettings(db, settings);
    });
    console.log('Automation settings IPC handlers registered');
}
