import React, { useState, useEffect } from 'react';
import { Expense, Category } from '../../shared/types';
import { useToast } from './ToastContainer';
import { api } from '../services/ipc-service';

interface EditExpenseModalProps {
  expense: Expense;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onExpenseUpdated: (expense: Expense) => void;
}

const EditExpenseModal: React.FC<EditExpenseModalProps> = ({
  expense,
  categories,
  isOpen,
  onClose,
  onExpenseUpdated,
}) => {
  const [amount, setAmount] = useState(expense.amount.toString());
  const [description, setDescription] = useState(expense.description);
  const [category, setCategory] = useState(expense.category);
  const [date, setDate] = useState(expense.date);
  const [vendor, setVendor] = useState(expense.vendor || '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen && expense) {
      setAmount(expense.amount.toString());
      setDescription(expense.description);
      setCategory(expense.category);
      setDate(expense.date);
      setVendor(expense.vendor || '');
      setErrors({});
    }
  }, [isOpen, expense]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = 'Amount must be a positive number';
    }

    if (parseFloat(amount) > 999999.99) {
      newErrors.amount = 'Amount cannot exceed $999,999.99';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (description.length > 255) {
      newErrors.description = 'Description cannot exceed 255 characters';
    }

    if (!category) {
      newErrors.category = 'Category is required';
    }

    if (!date) {
      newErrors.date = 'Date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const result = await api.expenses.update(expense.id, {
        amount: parseFloat(amount),
        description: description.trim(),
        category,
        date,
        vendor: vendor.trim() || null,
      });

      if (result.success && result.data) {
        showToast({
          type: 'success',
          title: 'Success',
          message: 'Expense updated successfully',
        });
        onExpenseUpdated(result.data);
        onClose();
      } else {
        showToast({
          type: 'error',
          title: 'Error',
          message: result.error || 'Failed to update expense',
        });
      }
    } catch (error) {
      console.error('Error updating expense:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to update expense. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content edit-expense-modal">
        <div className="modal-header">
          <h2>Edit Expense</h2>
          <button 
            type="button" 
            className="modal-close" 
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-expense-form">
          <div className="form-group">
            <label htmlFor="amount">Amount ($)</label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              min="0"
              max="999999.99"
              required
              className={errors.amount ? 'error' : ''}
            />
            {errors.amount && <span className="error-message">{errors.amount}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <input
              type="text"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={255}
              required
              className={errors.description ? 'error' : ''}
            />
            {errors.description && <span className="error-message">{errors.description}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className={errors.category ? 'error' : ''}
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
            {errors.category && <span className="error-message">{errors.category}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="date">Date</label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={errors.date ? 'error' : ''}
            />
            {errors.date && <span className="error-message">{errors.date}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="vendor">Vendor (Optional)</label>
            <input
              type="text"
              id="vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="button secondary" 
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="button primary" 
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditExpenseModal;