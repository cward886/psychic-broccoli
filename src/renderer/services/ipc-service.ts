import { Expense, Receipt, Category, ApiResponse } from '../../shared/types';

// Use the secure IPC API exposed via preload script
const electronAPI = (window as any).electronAPI;

// Type definitions for IPC communication
interface AnalysisData {
  categorySpending: Array<{
    name: string;
    color: string;
    icon: string;
    total: number;
    count: number;
  }>;
  monthlySpending: Array<{
    month: string;
    total: number;
    count: number;
  }>;
  topVendors: Array<{
    vendor: string;
    total: number;
    count: number;
  }>;
  dailyAverage: number;
}

interface DashboardData {
  totalExpenses: number;
  totalAmount: number;
  monthlyTotal: number;
  categoryTotals: Array<{
    name: string;
    color: string;
    total: number;
  }>;
}

interface ExportData {
  data: string;
  filename: string;
}

/**
 * IPC Service - Handles all communication between renderer and main process
 * This replaces the HTTP fetch calls with IPC communication
 */
export class IpcService {
  
  // Expenses
  static async getExpenses(): Promise<ApiResponse<Expense[]>> {
    return await electronAPI.invoke('get-expenses');
  }

  static async createExpense(expenseData: {
    amount: number;
    description: string;
    category: string;
    date: string;
    vendor?: string;
    tags?: string[];
  }): Promise<ApiResponse<Expense>> {
    return await electronAPI.invoke('create-expense', expenseData);
  }

  static async updateExpense(id: string, expenseData: {
    amount: number;
    description: string;
    category: string;
    date: string;
    vendor?: string;
    tags?: string[];
  }): Promise<ApiResponse<Expense>> {
    return await electronAPI.invoke('update-expense', id, expenseData);
  }

  static async deleteExpense(id: string): Promise<ApiResponse<{ message: string }>> {
    return await electronAPI.invoke('delete-expense', id);
  }

  // Categories
  static async getCategories(): Promise<ApiResponse<Category[]>> {
    return await electronAPI.invoke('get-categories');
  }

  // Receipts
  static async getReceipts(): Promise<ApiResponse<Receipt[]>> {
    return await electronAPI.invoke('get-receipts');
  }

  static async getExpenseReceipt(expenseId: string): Promise<ApiResponse<Receipt>> {
    return await electronAPI.invoke('get-expense-receipt', expenseId);
  }

  // Analysis
  static async getAnalysisData(): Promise<ApiResponse<AnalysisData>> {
    return await electronAPI.invoke('get-analysis-data');
  }

  // Dashboard
  static async getDashboardData(): Promise<ApiResponse<DashboardData>> {
    return await electronAPI.invoke('get-dashboard-data');
  }

  // Export
  static async exportData(format: 'csv' | 'json'): Promise<ApiResponse<ExportData>> {
    return await electronAPI.invoke('export-data', format);
  }

  // File operations
  static async selectReceiptFile(): Promise<string | null> {
    return await electronAPI.invoke('select-receipt-file');
  }

  static async processReceipt(filePath: string): Promise<ApiResponse<any>> {
    return await electronAPI.invoke('process-receipt', filePath);
  }

  // AI Assistant
  static async analyzeFinances(query: string, context: any): Promise<ApiResponse<string>> {
    return await electronAPI.invoke('analyze-finances', query, context);
  }
}

// Legacy HTTP-like interface for easier migration
// This maintains the same API as the old fetch-based system
export const api = {
  expenses: {
    getAll: () => IpcService.getExpenses(),
    create: (data: any) => IpcService.createExpense(data),
    update: (id: string, data: any) => IpcService.updateExpense(id, data),
    delete: (id: string) => IpcService.deleteExpense(id),
  },
  categories: {
    getAll: () => IpcService.getCategories(),
  },
  receipts: {
    getAll: () => IpcService.getReceipts(),
    getForExpense: (expenseId: string) => IpcService.getExpenseReceipt(expenseId),
  },
  analysis: {
    getData: () => IpcService.getAnalysisData(),
  },
  dashboard: {
    getData: () => IpcService.getDashboardData(),
  },
  export: {
    data: (format: 'csv' | 'json') => IpcService.exportData(format),
  },
  selectReceiptFile: () => IpcService.selectReceiptFile(),
  processReceipt: (filePath: string) => IpcService.processReceipt(filePath),
  ai: {
    analyzeFinances: (query: string, context: any) => IpcService.analyzeFinances(query, context),
  },
};

// Helper function to download exported data
export const downloadExportedData = (data: string, filename: string) => {
  const blob = new Blob([data], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export default IpcService;