const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  db: {
    run: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
    all: (sql, params) => ipcRenderer.invoke('db:all', sql, params),
    get: (sql, params) => ipcRenderer.invoke('db:get', sql, params),
    transaction: (queries) => ipcRenderer.invoke('db:transaction', queries),
    clientProductDelete: (id) => ipcRenderer.invoke('client-product:delete', id),
    clientProductUpdate: (id, quantity) => ipcRenderer.invoke('client-product:update', id, quantity),
    productDelete: (id, deleteClientProductIds) => ipcRenderer.invoke('product:delete', id, deleteClientProductIds),
  },
});
