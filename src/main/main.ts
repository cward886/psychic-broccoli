import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import { initDatabase, registerIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // Initialize database and register IPC handlers
  initDatabase();
  registerIpcHandlers();
  
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('select-receipt-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Receipts', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'pdf'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp'] },
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});