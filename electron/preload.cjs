const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvisDesktop', {
  platform: process.platform,
  installUpdate: (payload) => ipcRenderer.invoke('jarvis:update-install', payload),
  checkForUpdates: () => ipcRenderer.invoke('jarvis:update-check'),
  downloadUpdate: () => ipcRenderer.invoke('jarvis:update-download'),
  installUpdateNative: () => ipcRenderer.invoke('jarvis:update-install-native'),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('jarvis:update-status', listener);
    return () => ipcRenderer.off('jarvis:update-status', listener);
  }
});
