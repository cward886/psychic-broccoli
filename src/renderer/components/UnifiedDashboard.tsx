import React, { useState, useEffect } from 'react';
import { Expense, Receipt, Category } from '../../shared/types';
import ReceiptViewer from './ReceiptViewer';
import SearchFilter from './SearchFilter';
import EditExpenseModal from './EditExpenseModal';
import ConfirmationDialog from './ConfirmationDialog';
import { useToast } from './ToastContainer';
import { api } from '../services/ipc-service';

interface UnifiedDashboardProps {
  expenses: Expense[];
  receipts: Receipt[];
  categories: Category[];
  onExpenseAdded: (expense: Expense) => void;
  onExpenseUpdated: (expense: Expense) => void;
  onExpenseDeleted: (expenseId: string) => void;
  onReceiptProcessed: (receipt: Receipt) => void;
}

interface DashboardStats {
  totalExpenses: number;
  totalAmount: number;
  monthlyTotal: number;
  averagePerDay: number;
  lastExpenseDate: string;
  expenseCount: number;
}

const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({
  expenses,
  receipts,
  categories,
  onExpenseAdded,
  onExpenseUpdated,
  onExpenseDeleted,
  onReceiptProcessed
}) => {
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>(expenses);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showReceiptUpload, setShowReceiptUpload] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const { showToast } = useToast();

  // Add expense form state
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    vendor: '',
    tags: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    calculateStats();
  }, [expenses]);

  useEffect(() => {
    setFilteredExpenses(expenses);
  }, [expenses]);

  const calculateStats = () => {
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyExpenses = expenses.filter(expense => expense.date.startsWith(currentMonth));
    const monthlyTotal = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    // Calculate average per day based on days with expenses
    const uniqueDates = [...new Set(expenses.map(expense => expense.date))];
    const averagePerDay = uniqueDates.length > 0 ? totalAmount / uniqueDates.length : 0;
    
    const lastExpense = expenses.length > 0 ? expenses[0] : null;
    
    setStats({
      totalExpenses: expenses.length,
      totalAmount,
      monthlyTotal,
      averagePerDay,
      lastExpenseDate: lastExpense ? lastExpense.date : '',
      expenseCount: expenses.length
    });
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
  };

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.color : '#6c757d';
  };

  const handleExpenseUpdated = (updatedExpense: Expense) => {
    onExpenseUpdated(updatedExpense);
    setFilteredExpenses(prev => 
      prev.map(expense => 
        expense.id === updatedExpense.id ? updatedExpense : expense
      )
    );
  };

  const handleEditClick = (e: React.MouseEvent, expense: Expense) => {
    e.stopPropagation();
    setEditingExpense(expense);
  };

  const handleReceiptClick = (e: React.MouseEvent, expenseId: string) => {
    e.stopPropagation();
    setSelectedExpenseId(expenseId);
  };

  const handleDeleteClick = (e: React.MouseEvent, expense: Expense) => {
    e.stopPropagation();
    setDeletingExpense(expense);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingExpense) return;

    try {
      const result = await api.expenses.delete(deletingExpense.id);

      if (result.success) {
        showToast({
          type: 'success',
          title: 'Success',
          message: 'Expense deleted successfully',
        });

        setFilteredExpenses(prev => prev.filter(expense => expense.id !== deletingExpense.id));
        onExpenseDeleted(deletingExpense.id);
      } else {
        showToast({
          type: 'error',
          title: 'Error',
          message: result.error || 'Failed to delete expense',
        });
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete expense. Please try again.',
      });
    } finally {
      setDeletingExpense(null);
    }
  };

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.description || !formData.category) {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Please fill in all required fields'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await api.expenses.create({
        amount: parseFloat(formData.amount),
        description: formData.description,
        category: formData.category,
        date: formData.date,
        vendor: formData.vendor || undefined,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : []
      });

      if (result.success && result.data) {
        onExpenseAdded(result.data);
        setFormData({
          amount: '',
          description: '',
          category: '',
          date: new Date().toISOString().split('T')[0],
          vendor: '',
          tags: ''
        });
        setShowAddForm(false);
        showToast({
          type: 'success',
          title: 'Success',
          message: 'Expense added successfully!'
        });
      } else {
        showToast({
          type: 'error',
          title: 'Error',
          message: result.error || 'Failed to add expense'
        });
      }
    } catch (error) {
      console.error('Error adding expense:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to add expense. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleReceiptUpload = async () => {
    try {
      // Use IPC to open file dialog
      const filePath = await api.selectReceiptFile();
      
      if (filePath) {
        showToast({
          type: 'info',
          title: 'Processing',
          message: 'Processing receipt... This may take a moment.'
        });
        
        // Process the receipt
        const result = await api.processReceipt(filePath);
        
        if (result.success && result.data) {
          const { expense } = result.data;
          
          if (expense) {
            // Add the automatically created expense to the list
            onExpenseAdded(expense);
            
            showToast({
              type: 'success',
              title: 'Success',
              message: `Receipt processed successfully! Created expense for $${expense.amount}`
            });
          } else {
            showToast({
              type: 'warning',
              title: 'Processed',
              message: 'Receipt was processed but no expense was created automatically'
            });
          }
        } else {
          showToast({
            type: 'error',
            title: 'Error',
            message: result.error || 'Failed to process receipt'
          });
        }
      }
    } catch (error) {
      console.error('Error processing receipt:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to process receipt. Please try again.'
      });
    }
  };

  return (
    <div className="unified-dashboard">
      {/* Stats Header */}
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <div className="quick-actions">
          <button 
            className="button primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel' : 'Add Expense'}
          </button>
          <button 
            className="button secondary"
            onClick={() => setShowReceiptUpload(!showReceiptUpload)}
          >
            Upload Receipt
          </button>
        </div>
      </div>

      {/* High-level Stats */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">${stats.totalAmount.toFixed(2)}</div>
            <div className="stat-label">Total Spent</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">${stats.monthlyTotal.toFixed(2)}</div>
            <div className="stat-label">This Month</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.expenseCount}</div>
            <div className="stat-label">Total Expenses</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">${stats.averagePerDay.toFixed(2)}</div>
            <div className="stat-label">Daily Average</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.lastExpenseDate}</div>
            <div className="stat-label">Last Expense</div>
          </div>
        </div>
      )}

      {/* Add Expense Form */}
      {showAddForm && (
        <div className="card add-expense-form">
          <h3>Add New Expense</h3>
          <form onSubmit={handleAddExpenseSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Amount *</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description *</label>
                <input
                  type="text"
                  name="description"
                  placeholder="Enter expense description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Category *</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Vendor</label>
                <input
                  type="text"
                  name="vendor"
                  placeholder="Store or vendor name"
                  value={formData.vendor}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Tags</label>
                <input
                  type="text"
                  name="tags"
                  placeholder="Enter tags separated by commas"
                  value={formData.tags}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-actions">
              <button 
                type="submit" 
                className="button primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Adding...' : 'Add Expense'}
              </button>
              <button 
                type="button" 
                className="button secondary"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Receipt Upload */}
      {showReceiptUpload && (
        <div className="card receipt-upload-section">
          <h3>Upload Receipt</h3>
          <div className="upload-area">
            <input
              type="file"
              id="receipt-upload"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => {
                if (e.target.files) {
                  handleReceiptUpload();
                  setShowReceiptUpload(false);
                }
              }}
              style={{ display: 'none' }}
            />
            <label htmlFor="receipt-upload" className="upload-button">
              Choose Files
            </label>
            <p>Drag and drop receipt images or PDFs here, or click to select files</p>
          </div>
        </div>
      )}

      {/* Expense List */}
      <div className="card expense-section">
        <div className="expense-header">
          <h3>All Expenses</h3>
          <div className="expense-summary">
            <span>{filteredExpenses.length} expenses</span>
            <span className="total-amount">
              ${filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0).toFixed(2)}
            </span>
          </div>
        </div>

        <SearchFilter 
          expenses={expenses}
          categories={categories}
          onFilteredResults={setFilteredExpenses}
        />

        <div className="expense-list">
          {filteredExpenses.map(expense => (
            <div key={expense.id} className="expense-item">
              <div className="expense-info">
                <div className="expense-description">{expense.description}</div>
                <div className="expense-details">
                  <span className="expense-date">{expense.date}</span>
                  {expense.vendor && <span className="expense-vendor"> • {expense.vendor}</span>}
                  {expense.receiptId && <span className="has-receipt"> • 📄 Receipt</span>}
                </div>
              </div>
              <div className="expense-right">
                <div className="expense-amount">${expense.amount.toFixed(2)}</div>
                <div 
                  className="expense-category"
                  style={{ backgroundColor: getCategoryColor(expense.category) }}
                >
                  {getCategoryName(expense.category)}
                </div>
              </div>
              <div className="expense-actions">
                <button
                  className="expense-action-btn edit-btn"
                  onClick={(e) => handleEditClick(e, expense)}
                  title="Edit expense"
                >
                  ✏️
                </button>
                {expense.receiptId && (
                  <button
                    className="expense-action-btn receipt-btn"
                    onClick={(e) => handleReceiptClick(e, expense.id)}
                    title="View receipt"
                  >
                    📄
                  </button>
                )}
                <button
                  className="expense-action-btn delete-btn"
                  onClick={(e) => handleDeleteClick(e, expense)}
                  title="Delete expense"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredExpenses.length === 0 && (
          <div className="no-expenses">
            <p>No expenses found. Add your first expense to get started!</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedExpenseId && (
        <ReceiptViewer 
          expenseId={selectedExpenseId}
          onClose={() => setSelectedExpenseId(null)}
        />
      )}

      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          categories={categories}
          isOpen={!!editingExpense}
          onClose={() => setEditingExpense(null)}
          onExpenseUpdated={handleExpenseUpdated}
        />
      )}

      {deletingExpense && (
        <ConfirmationDialog
          isOpen={!!deletingExpense}
          title="Delete Expense"
          message={`Are you sure you want to delete "${deletingExpense.description}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingExpense(null)}
          isDestructive={true}
        />
      )}
    </div>
  );
};

export default UnifiedDashboard;