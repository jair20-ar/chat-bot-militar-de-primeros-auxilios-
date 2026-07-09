const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initDatabase, getDatabase, queryAll, queryGet, queryRun, deleteClientProduct, updateClientProductQuantity, deleteProduct } = require('./database');

const isDev = process.env.NODE_ENV === 'development';

function setupIPC() {
  ipcMain.handle('db:all', (_event, sql, params) => {
    return queryAll(sql, params);
  });

  ipcMain.handle('db:get', (_event, sql, params) => {
    return queryGet(sql, params);
  });

  ipcMain.handle('db:run', (_event, sql, params) => {
    return queryRun(sql, params);
  });

  ipcMain.handle('client-product:delete', async (_event, id) => {
    return deleteClientProduct(id);
  });

  ipcMain.handle('product:delete', async (_event, id, deleteClientProductIds) => {
    return deleteProduct(id, deleteClientProductIds);
  });

  ipcMain.handle('client-product:update', async (_event, id, quantity) => {
    return updateClientProductQuantity(id, quantity);
  });

  ipcMain.handle('db:transaction', async (_event, queries) => {
    try {
      const db = getDatabase();
      const runAll = db.transaction((items) => {
        for (const { sql, params } of items) {
          const result = db.prepare(sql).run(...params);
          if (result.changes === 0) throw new Error('Stock insuficiente');
        }
      });
      runAll(queries);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:4321');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  initDatabase();
  setupIPC();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
