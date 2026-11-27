const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rocknixNative', {
  isNative: true,
  init: () => ipcRenderer.invoke('cozyread:init'),
  rescanBooks: () => ipcRenderer.invoke('cozyread:rescan'),
  saveState: (state) => ipcRenderer.invoke('cozyread:save-state', state),
  loadBookPages: (bookId) => ipcRenderer.invoke('cozyread:load-pages', bookId),
  readBookBytes: (bookId) => ipcRenderer.invoke('cozyread:read-bytes', bookId),
  savePdfMeta: (payload) => ipcRenderer.invoke('cozyread:save-pdf-meta', payload),
  getBattery: () => ipcRenderer.invoke('cozyread:battery'),
  quitApp: () => ipcRenderer.invoke('cozyread:quit'),
  onNativeButton: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, btn) => callback(btn);
    ipcRenderer.on('cozyread:native-button', handler);
    return () => ipcRenderer.removeListener('cozyread:native-button', handler);
  },
});
