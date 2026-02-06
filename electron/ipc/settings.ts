import { ipcMain } from 'electron';
import * as settingsQueries from '../db/queries/settings';

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (_, key: string) => {
    try {
      return settingsQueries.getSetting(key);
    } catch (error) {
      console.error('Error getting setting:', error);
      throw error;
    }
  });

  ipcMain.handle('settings:set', async (_, data: { key: string; value: string }) => {
    try {
      settingsQueries.setSetting(data.key, data.value);
    } catch (error) {
      console.error('Error setting setting:', error);
      throw error;
    }
  });

  ipcMain.handle('settings:get-all', async () => {
    try {
      return settingsQueries.getAllSettings();
    } catch (error) {
      console.error('Error getting all settings:', error);
      throw error;
    }
  });

  console.log('Settings IPC handlers registered');
}
