import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../src/types';

console.log('[Preload] Script starting...');
console.log('[Preload] contextBridge available:', !!contextBridge);
console.log('[Preload] ipcRenderer available:', !!ipcRenderer);

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI: ElectronAPI = {
  invoke: (channel: string, ...args: any[]) => {
    // Whitelist of allowed channels
    const validChannels = [
      // Transactions
      'transactions:get-all',
      'transactions:get-by-id',
      'transactions:create',
      'transactions:update',
      'transactions:delete',
      'transactions:bulk-create',

      // Accounts
      'accounts:get-all',
      'accounts:get-by-id',
      'accounts:create',
      'accounts:update',
      'accounts:delete',

      // Categories
      'categories:get-all',
      'categories:get-tree',
      'categories:create',
      'categories:update',
      'categories:delete',

      // Budgets
      'budgets:get-by-month',
      'budgets:create',
      'budgets:update',
      'budgets:delete',
      'budgets:get-progress',
      'budgets:copy-to-next-month',

      // Goals
      'goals:get-all',
      'goals:get-by-id',
      'goals:create',
      'goals:update',
      'goals:delete',
      'goals:add-contribution',
      'goals:get-contributions',

      // Bills
      'bills:get-all',
      'bills:get-upcoming',
      'bills:create',
      'bills:update',
      'bills:delete',
      'bills:record-payment',
      'bills:get-payments',

      // Import
      'import:detect-format',
      'import:preview',
      'import:execute',

      // Analytics
      'analytics:dashboard',
      'analytics:spending-trends',
      'analytics:category-breakdown',
      'analytics:daily-spending',

      // Settings
      'settings:get',
      'settings:set',
      'settings:get-all',

      // Recorder
      'recorder:start',
      'recorder:stop',

      // Browser
      'browser:attach',
      'browser:detach',
      'browser:show',
      'browser:hide',
      'browser:navigate',
      'browser:back',
      'browser:forward',
      'browser:reload',
      'browser:start-recording',
      'browser:stop-recording',
      'browser:execute-step',
      'browser:prompt-sensitive-input',

      // Export recipes
      'export-recipes:get-all',
      'export-recipes:get-by-id',
      'export-recipes:create',
      'export-recipes:update',
      'export-recipes:delete',

      // Automation
      'automation:start-recording',
      'automation:stop-recording-window',
      'automation:save-recording',
      'automation:play-recording',
      'automation:provide-sensitive-input',
      'automation:start-recording-mode',
      'automation:get-current-recording',

      // Scraper
      'scraper:open-browser',

      // AI Scraper
      'ai-scraper:check-model',
      'ai-scraper:open-browser',
      'ai-scraper:execute',
      'ai-scraper:execute-html',

      // Ollama
      'ollama:check-status',
      'ollama:check-homebrew',
      'ollama:open-homebrew-install',
      'ollama:install',
      'ollama:start-server',
      'ollama:pull-model',
      'ollama:open-download-page',
      'ollama:generate',

      // Puppeteer Scraper
      'puppeteer:find-chrome',
      'puppeteer:start-browser',
      'puppeteer:start-recording',
      'puppeteer:stop-recording',
      'puppeteer:execute-recipe',
      'puppeteer:extract-transactions',
      'puppeteer:close-browser',

      // File operations
      'dialog:open-file',
    ];

    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }

    throw new Error(`Invalid IPC channel: ${channel}`);
  },

  on: (channel: string, callback: (...args: any[]) => void) => {
    // Whitelist of allowed receive channels
    const validReceiveChannels = [
      'csv:downloaded',
      'recorder:interaction',
      'browser:loading',
      'browser:url-changed',
      'browser:error',
      'automation:recording-saved',
      'automation:playback-complete',
      'automation:playback-needs-input',
      'scraper:transactions-found',
      'ollama:pull-progress',
      'ollama:install-progress',
    ];

    if (validReceiveChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => callback(...args));
    } else {
      throw new Error(`Invalid IPC receive channel: ${channel}`);
    }
  },

  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    const validReceiveChannels = [
      'csv:downloaded',
      'recorder:interaction',
      'browser:loading',
      'browser:url-changed',
      'browser:error',
      'automation:recording-saved',
      'automation:playback-complete',
      'automation:playback-needs-input',
      'scraper:transactions-found',
      'ollama:pull-progress',
      'ollama:install-progress',
    ];

    if (validReceiveChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, (_, ...args) => callback(...args));
    }
  },
} as any;

try {
  console.log('[Preload] Exposing API to main world...');
  contextBridge.exposeInMainWorld('electron', electronAPI);
  console.log('[Preload] ✅ API exposed successfully');
  console.log('[Preload] electronAPI:', electronAPI);
} catch (error) {
  console.error('[Preload] ❌ Failed to expose API:', error);
}

console.log('[Preload] Script completed');
