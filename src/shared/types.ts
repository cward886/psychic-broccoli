export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  receiptId?: string;
  vendor?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  filename: string;
  originalPath: string;
  processedPath?: string;
  ocrText?: string;
  extractedData?: ExtractedReceiptData;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedReceiptData {
  amount?: number;
  vendor?: string;
  date?: string;
  items?: ReceiptItem[];
  confidence?: number;
}

export interface ReceiptItem {
  description: string;
  price: number;
  quantity?: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  budgetLimit?: number;
  createdAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  period: 'monthly' | 'yearly';
  startDate: string;
  endDate?: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}