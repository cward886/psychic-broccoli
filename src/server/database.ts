import Database from 'better-sqlite3';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const dbPath = path.join(process.cwd(), 'database', 'expenses.db');
const db = new Database(dbPath);

export function getOrCreateCategory(vendorName: string): string {
  // Map vendor to traditional category with intelligent mapping
  const categoryMapping = intelligentVendorToCategory(vendorName);
  
  // Check if category already exists
  const existingCategory = db.prepare('SELECT id FROM categories WHERE name = ?').get(categoryMapping.name) as { id: string } | undefined;
  
  if (existingCategory) {
    return existingCategory.id;
  }
  
  // Create new category
  const categoryId = uuidv4();
  const insertCategory = db.prepare(`
    INSERT INTO categories (id, name, color, icon, category_type)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  insertCategory.run(categoryId, categoryMapping.name, categoryMapping.color, categoryMapping.icon, categoryMapping.type);
  console.log(`Created new category: ${categoryMapping.name} for vendor: ${vendorName}`);
  
  return categoryId;
}

function intelligentVendorToCategory(vendorName: string): { name: string; color: string; icon: string; type: string } {
  if (!vendorName) {
    return { name: 'Other', color: '#6c757d', icon: '📋', type: 'traditional' };
  }
  
  const vendor = vendorName.toLowerCase();
  
  // Food & Dining
  if (['walmart', 'target', 'kroger', 'aldi', 'costco', 'whole foods', 'trader joes', 'safeway', 'publix'].includes(vendor)) {
    return { name: 'Groceries', color: '#28a745', icon: '🛒', type: 'traditional' };
  }
  
  if (['mcdonalds', 'burger king', 'kfc', 'taco bell', 'subway', 'chipotle', 'starbucks', 'dunkin', 'panera'].includes(vendor)) {
    return { name: 'Restaurants', color: '#fd7e14', icon: '🍽️', type: 'traditional' };
  }
  
  if (['doordash', 'uber eats', 'grubhub', 'postmates', 'instacart'].includes(vendor)) {
    return { name: 'Food Delivery', color: '#dc3545', icon: '🚚', type: 'traditional' };
  }
  
  // Transportation
  if (['shell', 'exxon', 'chevron', 'bp', 'mobil', 'texaco', 'arco'].includes(vendor)) {
    return { name: 'Gas & Fuel', color: '#ffc107', icon: '⛽', type: 'traditional' };
  }
  
  if (['uber', 'lyft', 'taxi', 'metro', 'bus'].includes(vendor)) {
    return { name: 'Transportation', color: '#6f42c1', icon: '🚗', type: 'traditional' };
  }
  
  // Shopping
  if (['amazon', 'ebay', 'etsy', 'ali express'].includes(vendor)) {
    return { name: 'Online Shopping', color: '#ff9900', icon: '📦', type: 'traditional' };
  }
  
  if (['home depot', 'lowes', 'menards', 'home improvement'].includes(vendor)) {
    return { name: 'Home & Garden', color: '#e67e22', icon: '🏠', type: 'traditional' };
  }
  
  if (['best buy', 'apple', 'microsoft', 'gamestop', 'electronics'].includes(vendor)) {
    return { name: 'Electronics', color: '#3498db', icon: '💻', type: 'traditional' };
  }
  
  // Health & Personal Care
  if (['cvs', 'walgreens', 'rite aid', 'pharmacy'].includes(vendor)) {
    return { name: 'Pharmacy & Health', color: '#e74c3c', icon: '💊', type: 'traditional' };
  }
  
  // Entertainment
  if (['netflix', 'spotify', 'hulu', 'disney', 'amazon prime', 'youtube'].includes(vendor)) {
    return { name: 'Entertainment', color: '#9b59b6', icon: '🎬', type: 'traditional' };
  }
  
  // Bills & Utilities
  if (['electric', 'gas', 'water', 'internet', 'phone', 'cable', 'at&t', 'verizon', 't-mobile'].includes(vendor)) {
    return { name: 'Bills & Utilities', color: '#34495e', icon: '📄', type: 'traditional' };
  }
  
  // Default to creating a vendor-specific category but with better classification
  return { name: capitalizeVendorName(vendorName), color: '#6c757d', icon: '🏪', type: 'vendor' };
}

function capitalizeVendorName(name: string): string {
  return name.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

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

  const categories = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  
  if (categories.count === 0) {
    const insertCategory = db.prepare(`
      INSERT INTO categories (id, name, color, icon, category_type)
      VALUES (?, ?, ?, ?, ?)
    `);

    const defaultTraditionalCategories = [
      { name: 'Groceries', color: '#28a745', icon: '🛒', type: 'traditional' },
      { name: 'Restaurants', color: '#fd7e14', icon: '🍽️', type: 'traditional' },
      { name: 'Food Delivery', color: '#dc3545', icon: '🚚', type: 'traditional' },
      { name: 'Gas & Fuel', color: '#ffc107', icon: '⛽', type: 'traditional' },
      { name: 'Transportation', color: '#6f42c1', icon: '🚗', type: 'traditional' },
      { name: 'Online Shopping', color: '#ff9900', icon: '📦', type: 'traditional' },
      { name: 'Home & Garden', color: '#e67e22', icon: '🏠', type: 'traditional' },
      { name: 'Electronics', color: '#3498db', icon: '💻', type: 'traditional' },
      { name: 'Pharmacy & Health', color: '#e74c3c', icon: '💊', type: 'traditional' },
      { name: 'Entertainment', color: '#9b59b6', icon: '🎬', type: 'traditional' },
      { name: 'Bills & Utilities', color: '#34495e', icon: '📄', type: 'traditional' },
      { name: 'Personal Care', color: '#17a2b8', icon: '💅', type: 'traditional' },
      { name: 'Travel', color: '#20c997', icon: '✈️', type: 'traditional' },
      { name: 'Education', color: '#6610f2', icon: '🎓', type: 'traditional' },
      { name: 'Other', color: '#6c757d', icon: '📋', type: 'traditional' }
    ];

    for (const category of defaultTraditionalCategories) {
      insertCategory.run(uuidv4(), category.name, category.color, category.icon, category.type);
    }
  }

  console.log('Database initialized successfully');
}

// Prepared statements for better performance
export const preparedStatements = {
  // Expenses
  getAllExpenses: db.prepare(`
    SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM expenses e
    LEFT JOIN categories c ON e.category = c.id
    ORDER BY e.date DESC, e.created_at DESC
  `),
  
  getExpensesByCategory: db.prepare(`
    SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM expenses e
    LEFT JOIN categories c ON e.category = c.id
    WHERE e.category = ?
    ORDER BY e.date DESC, e.created_at DESC
  `),
  
  getExpensesByDateRange: db.prepare(`
    SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM expenses e
    LEFT JOIN categories c ON e.category = c.id
    WHERE e.date >= ? AND e.date <= ?
    ORDER BY e.date DESC, e.created_at DESC
  `),
  
  getExpensesByAmountRange: db.prepare(`
    SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM expenses e
    LEFT JOIN categories c ON e.category = c.id
    WHERE e.amount >= ? AND e.amount <= ?
    ORDER BY e.date DESC, e.created_at DESC
  `),
  
  // Categories
  getAllCategories: db.prepare('SELECT * FROM categories ORDER BY name'),
  getCategoryById: db.prepare('SELECT * FROM categories WHERE id = ?'),
  getCategoryByName: db.prepare('SELECT * FROM categories WHERE name = ?'),
  
  // Receipts
  getAllReceipts: db.prepare('SELECT * FROM receipts ORDER BY created_at DESC'),
  getReceiptById: db.prepare('SELECT * FROM receipts WHERE id = ?'),
  getReceiptsByStatus: db.prepare('SELECT * FROM receipts WHERE status = ? ORDER BY created_at DESC'),
  
  // Analytics
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
  `),
  
  // Search
  searchExpenses: db.prepare(`
    SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM expenses e
    LEFT JOIN categories c ON e.category = c.id
    WHERE e.description LIKE ? OR e.vendor LIKE ? OR c.name LIKE ?
    ORDER BY e.date DESC, e.created_at DESC
  `)
};

// Performance optimization functions
export function enableWALMode() {
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA cache_size = 1000');
  db.exec('PRAGMA temp_store = MEMORY');
  console.log('Database optimizations enabled');
}

export function analyzeDatabase() {
  db.exec('ANALYZE');
  console.log('Database statistics updated');
}

export function vacuumDatabase() {
  db.exec('VACUUM');
  console.log('Database vacuumed');
}

// Audit logging function
export function logExpenseChange(expenseId: string, action: 'create' | 'update' | 'delete', oldValues?: any, newValues?: any) {
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

export default db;