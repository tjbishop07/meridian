const { contextBridge, ipcRenderer } = require('electron');

// Expose minimal API for AI scraper window
contextBridge.exposeInMainWorld('aiScraper', {
  executeScrape: () => {
    ipcRenderer.send('ai-scraper:trigger');
  },
  executeScrapeHTML: () => {
    // Use HTML-based scraping (faster, more accurate)
    ipcRenderer.invoke('ai-scraper:execute-html');
  }
});
