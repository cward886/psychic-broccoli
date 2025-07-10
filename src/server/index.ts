import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import db, { initDatabase, preparedStatements, enableWALMode, analyzeDatabase, logExpenseChange } from './database';
import { processReceipt } from './receipt-processor';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image files and PDFs are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Validation helpers
function isValidDate(dateString: string): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

initDatabase();
enableWALMode();

// Analyze database on startup for better query performance
setTimeout(() => {
  analyzeDatabase();
}, 5000);

app.get('/api/expenses', (req, res) => {
  try {
    const expenses = preparedStatements.getAllExpenses.all();
    res.json({ success: true, data: expenses });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/expenses', (req, res) => {
  try {
    const { amount, description, category, date, vendor, tags } = req.body;
    
    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be a positive number' });
    }
    
    if (!description || description.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Description is required' });
    }
    
    if (!category || category.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Category is required' });
    }
    
    if (!date || !isValidDate(date)) {
      return res.status(400).json({ success: false, error: 'Valid date is required' });
    }
    
    if (amount > 999999.99) {
      return res.status(400).json({ success: false, error: 'Amount cannot exceed $999,999.99' });
    }
    
    if (description.length > 255) {
      return res.status(400).json({ success: false, error: 'Description cannot exceed 255 characters' });
    }
    
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO expenses (id, amount, description, category, date, vendor, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, amount, description.trim(), category.trim(), date, vendor?.trim() || null, tags ? JSON.stringify(tags) : null);

    const expense = db.prepare(`
      SELECT e.*, c.name as category_name, c.color as category_color
      FROM expenses e
      LEFT JOIN categories c ON e.category = c.id
      WHERE e.id = ?
    `).get(id);

    // Log the expense creation
    logExpenseChange(id, 'create', null, expense);

    res.json({ success: true, data: expense });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/categories', (req, res) => {
  try {
    const categories = preparedStatements.getAllCategories.all();
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/receipts', (req, res) => {
  try {
    const receipts = preparedStatements.getAllReceipts.all();
    res.json({ success: true, data: receipts });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/receipts', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, error: 'Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.' });
    }

    // Validate file size (10MB max)
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'File size too large. Maximum size is 10MB.' });
    }

    // Check if file actually exists
    if (!fs.existsSync(req.file.path)) {
      return res.status(500).json({ success: false, error: 'File upload failed. Please try again.' });
    }

    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO receipts (id, filename, original_path, status)
      VALUES (?, ?, ?, 'pending')
    `);

    stmt.run(id, sanitizeInput(req.file.filename), req.file.path);

    const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id) as any;

    if (!receipt) {
      return res.status(500).json({ success: false, error: 'Failed to create receipt record' });
    }

    // Process receipt asynchronously
    processReceipt(receipt.id, receipt.original_path).catch(error => {
      console.error('Error processing receipt:', error);
      // Update receipt status to failed
      const updateStmt = db.prepare('UPDATE receipts SET status = ? WHERE id = ?');
      updateStmt.run('failed', receipt.id);
    });

    res.json({ success: true, data: receipt });
  } catch (error) {
    console.error('Error uploading receipt:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.put('/api/expenses/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, category, date, vendor, tags } = req.body;
    
    // Validate UUID format
    if (!id || !isValidUUID(id)) {
      return res.status(400).json({ success: false, error: 'Invalid expense ID format' });
    }
    
    // Check if expense exists and get current values for audit log
    const existingExpense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    if (!existingExpense) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    
    // Validation (same as POST)
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be a positive number' });
    }
    
    if (!description || description.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Description is required' });
    }
    
    if (!category || category.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Category is required' });
    }
    
    if (!date || !isValidDate(date)) {
      return res.status(400).json({ success: false, error: 'Valid date is required' });
    }
    
    if (amount > 999999.99) {
      return res.status(400).json({ success: false, error: 'Amount cannot exceed $999,999.99' });
    }
    
    if (description.length > 255) {
      return res.status(400).json({ success: false, error: 'Description cannot exceed 255 characters' });
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
    
    res.json({ success: true, data: updatedExpense });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.delete('/api/expenses/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate UUID format
    if (!id || !isValidUUID(id)) {
      return res.status(400).json({ success: false, error: 'Invalid expense ID format' });
    }
    
    // Check if expense exists and get current values for audit log
    const existingExpense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    if (!existingExpense) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    
    // Delete the expense
    const deleteStmt = db.prepare('DELETE FROM expenses WHERE id = ?');
    const result = deleteStmt.run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    
    // Log the expense deletion
    logExpenseChange(id, 'delete', existingExpense, null);
    
    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/expenses/:id/receipt', (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate UUID format
    if (!id || !isValidUUID(id)) {
      return res.status(400).json({ success: false, error: 'Invalid expense ID format' });
    }
    
    const receipt = db.prepare(`
      SELECT r.*, e.description as expense_description, e.amount as expense_amount
      FROM receipts r
      JOIN expenses e ON r.id = e.receipt_id
      WHERE e.id = ?
    `).get(id);
    
    if (receipt) {
      res.json({ success: true, data: receipt });
    } else {
      res.status(404).json({ success: false, error: 'Receipt not found for this expense' });
    }
  } catch (error) {
    console.error('Error fetching receipt:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

app.get('/api/analysis', (req, res) => {
  try {
    // Get spending by category
    const categorySpending = preparedStatements.getCategorySpending.all();

    // Get monthly spending trend
    const monthlySpending = preparedStatements.getMonthlySpending.all();

    // Get top vendors
    const topVendors = preparedStatements.getTopVendors.all();

    // Get daily average
    const dailyAverage = preparedStatements.getDailyAverage.get() as { average: number } | undefined;

    res.json({
      success: true,
      data: {
        categorySpending,
        monthlySpending,
        topVendors,
        dailyAverage: dailyAverage?.average || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/dashboard', (req, res) => {
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

    res.json({
      success: true,
      data: {
        totalExpenses: totalExpenses.count,
        totalAmount: totalAmount.total || 0,
        monthlyTotal: monthlyTotal.total || 0,
        categoryTotals
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Export data endpoints
app.get('/api/export/csv', (req, res) => {
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

    const csv = csvHeaders + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="expenses_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/export/json', (req, res) => {
  try {
    const expenses = db.prepare(`
      SELECT 
        e.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
      FROM expenses e
      LEFT JOIN categories c ON e.category = c.id
      ORDER BY e.date DESC
    `).all();

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

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="expenses_backup_${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Global error handler
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Global error handler:', error);
  
  // Handle multer errors
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File too large. Maximum size is 10MB.' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ success: false, error: 'Unexpected file field.' });
    }
    return res.status(400).json({ success: false, error: error.message });
  }
  
  // Handle other errors
  if (error.message && error.message.includes('Only image files and PDFs are allowed')) {
    return res.status(400).json({ success: false, error: error.message });
  }
  
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});