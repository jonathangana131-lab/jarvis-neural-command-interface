const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvisDesktop', {
  platform: process.platform,
  installUpdate: (payload) => ipcRenderer.invoke('jarvis:update-install', payload)
});
