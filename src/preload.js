const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    facebookLogin: (data) => ipcRenderer.invoke('facebook-login', data),
    importCookies: () => ipcRenderer.invoke('import-cookies'),
    scrapePostData: (data) => ipcRenderer.invoke('scrape-post-data', data),
    scrapeGroupMembers: (data) => ipcRenderer.invoke('scrape-group-members', data),
    scrapeSearchResults: (data) => ipcRenderer.invoke('scrape-search-results', data),
    exportToCSV: (data) => ipcRenderer.invoke('export-to-csv', data),
    exportToExcel: (data) => ipcRenderer.invoke('export-to-excel', data),
    onUpdateLogs: (callback) => ipcRenderer.on('update-logs', callback)
});