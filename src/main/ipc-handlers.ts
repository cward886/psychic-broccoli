import { ipcMain } from 'electron';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { app } from 'electron';
import { processReceiptFile } from './receipt-processor';
import { ollamaService } from './ollama-service';

// Database setup
const dbPath = path.join(app.getPath('userData'), 'expenses.db');
const db = new Database(dbPath);

// Ensure user data directory exists
const uploadsDir = path.join(app.getPath('userData'), 'uploads');
const processedDir = path.join(uploadsDir, 'processed');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(processedDir)) {
  fs.mkdirSync(processedDir, { recursive: true });
}

// Database initialization
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      icon TEXT,
      category_type TEXT DEFAULT 'traditional',
      budget_limit REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_path TEXT NOT NULL,
      processed_path TEXT,
      ocr_text TEXT,
      extracted_data TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      receipt_id TEXT,
      vendor TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (receipt_id) REFERENCES receipts(id),
      FOREIGN KEY (category) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS expense_audit_log (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL,
      action TEXT NOT NULL,
      old_values TEXT,
      new_values TEXT,
      changed_fields TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      amount REAL NOT NULL,
      period TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
    CREATE INDEX IF NOT EXISTS idx_expenses_vendor ON expenses(vendor);
    CREATE INDEX IF NOT EXISTS idx_expenses_amount ON expenses(amount);
    CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
    CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
    CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at);
    CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
    CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(category_type);
    CREATE INDEX IF NOT EXISTS idx_audit_log_expense_id ON expense_audit_log(expense_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON expense_audit_log(timestamp);
  `);

  // Initialize default categories if none exist
  const categories = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  
  if (categories.count === 0) {
    const insertCategory = db.prepare(`
      INSERT INTO categories (id, name, color, icon, category_type)
      VALUES (?, ?, ?, ?, ?)
    `);

    const defaultCategories = [
      { name: 'Groceries', color: '#28a745', icon: 'G', type: 'traditional' },
      { name: 'Restaurants', color: '#fd7e14', icon: 'R', type: 'traditional' },
      { name: 'Food Delivery', color: '#dc3545', icon: 'FD', type: 'traditional' },
      { name: 'Gas & Fuel', color: '#ffc107', icon: 'GF', type: 'traditional' },
      { name: 'Transportation', color: '#6f42c1', icon: 'T', type: 'traditional' },
      { name: 'Online Shopping', color: '#ff9900', icon: 'OS', type: 'traditional' },
      { name: 'Home & Garden', color: '#e67e22', icon: 'HG', type: 'traditional' },
      { name: 'Electronics', color: '#3498db', icon: 'E', type: 'traditional' },
      { name: 'Pharmacy & Health', color: '#e74c3c', icon: 'PH', type: 'traditional' },
      { name: 'Entertainment', color: '#9b59b6', icon: 'EN', type: 'traditional' },
      { name: 'Bills & Utilities', color: '#34495e', icon: 'BU', type: 'traditional' },
      { name: 'Personal Care', color: '#17a2b8', icon: 'PC', type: 'traditional' },
      { name: 'Travel', color: '#20c997', icon: 'TR', type: 'traditional' },
      { name: 'Education', color: '#6610f2', icon: 'ED', type: 'traditional' },
      { name: 'Other', color: '#6c757d', icon: 'O', type: 'traditional' }
    ];

    for (const category of defaultCategories) {
      insertCategory.run(uuidv4(), category.name, category.color, category.icon, category.type);
    }
  }

  // Enable WAL mode for better performance
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA cache_size = 1000');
  db.exec('PRAGMA temp_store = MEMORY');

  // Initialize prepared statements after database is ready
  preparedStatements = {
    getAllExpenses: db.prepare(`
      SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM expenses e
      LEFT JOIN categories c ON e.category = c.id
      ORDER BY e.date DESC, e.created_at DESC
    `),
    getAllCategories: db.prepare('SELECT * FROM categories ORDER BY name'),
    getAllReceipts: db.prepare('SELECT * FROM receipts ORDER BY created_at DESC'),
    getExpenseById: db.prepare('SELECT * FROM expenses WHERE id = ?'),
    getCategorySpending: db.prepare(`
      SELECT c.name, c.color, c.icon, SUM(e.amount) as total, COUNT(e.id) as count
      FROM expenses e
      JOIN categories c ON e.category = c.id
      GROUP BY c.id, c.name, c.color, c.icon
      ORDER BY total DESC
    `),
    getMonthlySpending: db.prepare(`
      SELECT strftime('%Y-%m', date) as month, SUM(amount) as total, COUNT(*) as count
      FROM expenses
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month DESC
      LIMIT 12
    `),
    getTopVendors: db.prepare(`
      SELECT vendor, SUM(amount) as total, COUNT(*) as count
      FROM expenses
      WHERE vendor IS NOT NULL AND vendor != ''
      GROUP BY vendor
      ORDER BY total DESC
      LIMIT 10
    `),
    getDailyAverage: db.prepare(`
      SELECT AVG(daily_total) as average
      FROM (
        SELECT date, SUM(amount) as daily_total
        FROM expenses
        GROUP BY date
      )
    `)
  };

  console.log('Database initialized successfully');
}

// Prepared statements for better performance
let preparedStatements: any = {};

// Utility functions
function isValidDate(dateString: string): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

function logExpenseChange(expenseId: string, action: 'create' | 'update' | 'delete', oldValues?: any, newValues?: any) {
  const changedFields = [];
  
  if (action === 'update' && oldValues && newValues) {
    for (const key in newValues) {
      if (oldValues[key] !== newValues[key]) {
        changedFields.push(key);
      }
    }
  }
  
  const auditLogId = uuidv4();
  const auditStmt = db.prepare(`
    INSERT INTO expense_audit_log (id, expense_id, action, old_values, new_values, changed_fields)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  auditStmt.run(
    auditLogId,
    expenseId,
    action,
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null,
    changedFields.length > 0 ? JSON.stringify(changedFields) : null
  );
}

// IPC Handlers
export function registerIpcHandlers() {
  // Get all expenses
  ipcMain.handle('get-expenses', async () => {
    try {
      const expenses = preparedStatements.getAllExpenses.all();
      return { success: true, data: expenses };
    } catch (error) {
      console.error('Error fetching expenses:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get all categories
  ipcMain.handle('get-categories', async () => {
    try {
      const categories = preparedStatements.getAllCategories.all();
      return { success: true, data: categories };
    } catch (error) {
      console.error('Error fetching categories:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get all receipts
  ipcMain.handle('get-receipts', async () => {
    try {
      const receipts = preparedStatements.getAllReceipts.all();
      return { success: true, data: receipts };
    } catch (error) {
      console.error('Error fetching receipts:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Create expense
  ipcMain.handle('create-expense', async (event, expenseData) => {
    try {
      const { amount, description, category, date, vendor, tags } = expenseData;
      
      // Validation
      if (!amount || amount <= 0) {
        return { success: false, error: 'Amount must be a positive number' };
      }
      
      if (!description || description.trim().length === 0) {
        return { success: false, error: 'Description is required' };
      }
      
      if (!category || category.trim().length === 0) {
        return { success: false, error: 'Category is required' };
      }
      
      if (!date || !isValidDate(date)) {
        return { success: false, error: 'Valid date is required' };
      }
      
      if (amount > 999999.99) {
        return { success: false, error: 'Amount cannot exceed $999,999.99' };
      }
      
      if (description.length > 255) {
        return { success: false, error: 'Description cannot exceed 255 characters' };
      }
      
      const id = uuidv4();
      
      const stmt = db.prepare(`
        INSERT INTO expenses (id, amount, description, category, date, vendor, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(id, amount, description.trim(), category.trim(), date, vendor?.trim() || null, tags ? JSON.stringify(tags) : null);

      const expense = db.prepare(`
        SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM expenses e
        LEFT JOIN categories c ON e.category = c.id
        WHERE e.id = ?
      `).get(id);

      // Log the expense creation
      logExpenseChange(id, 'create', null, expense);

      return { success: true, data: expense };
    } catch (error) {
      console.error('Error creating expense:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Update expense
  ipcMain.handle('update-expense', async (event, id, expenseData) => {
    try {
      const { amount, description, category, date, vendor, tags } = expenseData;
      
      // Validate UUID format
      if (!id || !isValidUUID(id)) {
        return { success: false, error: 'Invalid expense ID format' };
      }
      
      // Check if expense exists and get current values for audit log
      const existingExpense = preparedStatements.getExpenseById.get(id);
      if (!existingExpense) {
        return { success: false, error: 'Expense not found' };
      }
      
      // Validation (same as create)
      if (!amount || amount <= 0) {
        return { success: false, error: 'Amount must be a positive number' };
      }
      
      if (!description || description.trim().length === 0) {
        return { success: false, error: 'Description is required' };
      }
      
      if (!category || category.trim().length === 0) {
        return { success: false, error: 'Category is required' };
      }
      
      if (!date || !isValidDate(date)) {
        return { success: false, error: 'Valid date is required' };
      }
      
      if (amount > 999999.99) {
        return { success: false, error: 'Amount cannot exceed $999,999.99' };
      }
      
      if (description.length > 255) {
        return { success: false, error: 'Description cannot exceed 255 characters' };
      }
      
      // Update expense
      const updateStmt = db.prepare(`
        UPDATE expenses 
        SET amount = ?, description = ?, category = ?, date = ?, vendor = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      updateStmt.run(amount, description.trim(), category.trim(), date, vendor?.trim() || null, tags ? JSON.stringify(tags) : null, id);
      
      // Return updated expense with category info
      const updatedExpense = db.prepare(`
        SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM expenses e
        LEFT JOIN categories c ON e.category = c.id
        WHERE e.id = ?
      `).get(id);
      
      // Log the expense update
      const newValues = {
        amount: parseFloat(amount),
        description: description.trim(),
        category: category.trim(),
        date,
        vendor: vendor?.trim() || null,
        tags: tags ? JSON.stringify(tags) : null
      };
      logExpenseChange(id, 'update', existingExpense, newValues);
      
      return { success: true, data: updatedExpense };
    } catch (error) {
      console.error('Error updating expense:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Delete expense
  ipcMain.handle('delete-expense', async (event, id) => {
    try {
      // Validate UUID format
      if (!id || !isValidUUID(id)) {
        return { success: false, error: 'Invalid expense ID format' };
      }
      
      // Check if expense exists and get current values for audit log
      const existingExpense = preparedStatements.getExpenseById.get(id);
      if (!existingExpense) {
        return { success: false, error: 'Expense not found' };
      }
      
      // Delete the expense
      const deleteStmt = db.prepare('DELETE FROM expenses WHERE id = ?');
      const result = deleteStmt.run(id);
      
      if (result.changes === 0) {
        return { success: false, error: 'Expense not found' };
      }
      
      // Log the expense deletion
      logExpenseChange(id, 'delete', existingExpense, null);
      
      return { success: true, message: 'Expense deleted successfully' };
    } catch (error) {
      console.error('Error deleting expense:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get receipt for expense
  ipcMain.handle('get-expense-receipt', async (event, expenseId) => {
    try {
      // Validate UUID format
      if (!expenseId || !isValidUUID(expenseId)) {
        return { success: false, error: 'Invalid expense ID format' };
      }
      
      const receipt = db.prepare(`
        SELECT r.*, e.description as expense_description, e.amount as expense_amount
        FROM receipts r
        JOIN expenses e ON r.id = e.receipt_id
        WHERE e.id = ?
      `).get(expenseId);
      
      if (receipt) {
        return { success: true, data: receipt };
      } else {
        return { success: false, error: 'Receipt not found for this expense' };
      }
    } catch (error) {
      console.error('Error fetching receipt:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get analysis data
  ipcMain.handle('get-analysis-data', async () => {
    try {
      // Get spending by category
      const categorySpending = preparedStatements.getCategorySpending.all();

      // Get monthly spending trend
      const monthlySpending = preparedStatements.getMonthlySpending.all();

      // Get top vendors
      const topVendors = preparedStatements.getTopVendors.all();

      // Get daily average
      const dailyAverage = preparedStatements.getDailyAverage.get() as { average: number } | undefined;

      return {
        success: true,
        data: {
          categorySpending,
          monthlySpending,
          topVendors,
          dailyAverage: dailyAverage?.average || 0
        }
      };
    } catch (error) {
      console.error('Error fetching analysis data:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get dashboard data
  ipcMain.handle('get-dashboard-data', async () => {
    try {
      const totalExpenses = db.prepare('SELECT COUNT(*) as count FROM expenses').get() as { count: number };
      const totalAmount = db.prepare('SELECT SUM(amount) as total FROM expenses').get() as { total: number };
      const monthlyTotal = db.prepare(`
        SELECT SUM(amount) as total 
        FROM expenses 
        WHERE date >= date('now', 'start of month')
      `).get() as { total: number };

      const categoryTotals = db.prepare(`
        SELECT c.name, c.color, SUM(e.amount) as total
        FROM expenses e
        JOIN categories c ON e.category = c.id
        WHERE e.date >= date('now', 'start of month')
        GROUP BY c.id, c.name, c.color
        ORDER BY total DESC
      `).all();

      return {
        success: true,
        data: {
          totalExpenses: totalExpenses.count,
          totalAmount: totalAmount.total || 0,
          monthlyTotal: monthlyTotal.total || 0,
          categoryTotals
        }
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Export data
  ipcMain.handle('export-data', async (event, format) => {
    try {
      const expenses = db.prepare(`
        SELECT 
          e.id,
          e.amount,
          e.description,
          c.name as category,
          e.date,
          e.vendor,
          e.created_at
        FROM expenses e
        LEFT JOIN categories c ON e.category = c.id
        ORDER BY e.date DESC
      `).all();

      if (format === 'csv') {
        // Create CSV content
        const csvHeaders = 'ID,Amount,Description,Category,Date,Vendor,Created At\n';
        const csvRows = expenses.map((expense: any) => {
          const row = [
            expense.id,
            expense.amount,
            `"${expense.description.replace(/"/g, '""')}"`,
            expense.category || 'Unknown',
            expense.date,
            expense.vendor || '',
            expense.created_at
          ];
          return row.join(',');
        }).join('\n');

        return {
          success: true,
          data: csvHeaders + csvRows,
          filename: `expenses_${new Date().toISOString().split('T')[0]}.csv`
        };
      } else if (format === 'json') {
        const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
        const receipts = db.prepare('SELECT * FROM receipts ORDER BY created_at DESC').all();

        const exportData = {
          exportDate: new Date().toISOString(),
          totalExpenses: expenses.length,
          totalAmount: expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0),
          data: {
            expenses,
            categories,
            receipts
          }
        };

        return {
          success: true,
          data: JSON.stringify(exportData, null, 2),
          filename: `expenses_backup_${new Date().toISOString().split('T')[0]}.json`
        };
      }

      return { success: false, error: 'Invalid export format' };
    } catch (error) {
      console.error('Error exporting data:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Process receipt file
  ipcMain.handle('process-receipt', async (event, filePath) => {
    try {
      console.log('Processing receipt file:', filePath);
      const result = await processReceiptFile(filePath);
      return result;
    } catch (error) {
      console.error('Error processing receipt:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // AI Assistant handler
  ipcMain.handle('analyze-finances', async (event, query: string, context: any) => {
    try {
      // Check if Ollama is available
      const isOllamaReady = await ollamaService.checkHealth();
      
      if (!isOllamaReady) {
        // Fallback to basic analysis without LLM
        return {
          success: true,
          data: performBasicAnalysis(query, context)
        };
      }

      // Use Gemma 2B for intelligent analysis
      const response = await ollamaService.analyzeFinances(query, context);
      
      return {
        success: true,
        data: response || performBasicAnalysis(query, context)
      };
    } catch (error) {
      console.error('Error analyzing finances:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed'
      };
    }
  });

  console.log('IPC handlers registered successfully');
}

// Basic analysis fallback when LLM is not available
function performBasicAnalysis(query: string, context: any): string {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('spending') && lowerQuery.includes('categor')) {
    const categories = context.expensesByCategory
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 5)
      .map((cat: any) => `${cat.name}: $${cat.total} (${cat.percentage}%)`)
      .join('\n');
    
    return `Your top spending categories are:\n\n${categories}\n\nTotal expenses: $${context.totalExpenses}`;
  }
  
  if (lowerQuery.includes('last month') || lowerQuery.includes('monthly')) {
    const lastMonth = context.monthlySpending[0];
    if (lastMonth) {
      return `Last month (${lastMonth.month}), you spent $${lastMonth.total}.`;
    }
    return "I don't have enough data about your monthly spending yet.";
  }
  
  if (lowerQuery.includes('vendor')) {
    const vendors = context.topVendors
      .map((v: any) => `${v.vendor}: $${v.total}`)
      .join('\n');
    
    return vendors ? `Your top vendors are:\n\n${vendors}` : "No vendor data available yet.";
  }
  
  if (lowerQuery.includes('average')) {
    return `Your average expense is $${context.averageExpense} across ${context.numberOfExpenses} transactions.`;
  }
  
  return `You have ${context.numberOfExpenses} expenses totaling $${context.totalExpenses}. Try asking about spending categories, monthly trends, or top vendors for more specific insights.`;
}

// Export database for use in other modules
export { db, uploadsDir, processedDir };