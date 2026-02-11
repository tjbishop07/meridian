const { contextBridge, ipcRenderer } = require('electron');

// Expose minimal API for scraper window
contextBridge.exposeInMainWorld('scraper', {
  executeScrape: () => {
    ipcRenderer.send('scraper:execute');
  }
});
