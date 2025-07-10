import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: any[]) => {
    // Whitelist channels for security
    const validChannels = [
      'get-expenses',
      'create-expense',
      'update-expense',
      'delete-expense',
      'get-categories',
      'get-receipts',
      'get-expense-receipt',
      'get-analysis-data',
      'get-dashboard-data',
      'export-data',
      'select-receipt-file',
      'process-receipt'
    ];
    
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    
    throw new Error(`Invalid IPC channel: ${channel}`);
  }
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
  }
}