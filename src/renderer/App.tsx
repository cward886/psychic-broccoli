import React, { useState, useEffect } from 'react';
import { Expense, Receipt, Category } from '../shared/types';
import UnifiedDashboard from './components/UnifiedDashboard';
import Analysis from './components/Analysis';
import AIAssistant from './components/AIAssistant';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastContainer, useToast } from './components/ToastContainer';
import { api } from './services/ipc-service';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'assistant'>('dashboard');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [expensesRes, receiptsRes, categoriesRes] = await Promise.all([
        api.expenses.getAll(),
        api.receipts.getAll(),
        api.categories.getAll()
      ]);

      if (expensesRes.success) {
        setExpenses(expensesRes.data || []);
      } else {
        console.error('Failed to fetch expenses:', expensesRes.error);
        showToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to load expenses'
        });
      }

      if (receiptsRes.success) {
        setReceipts(receiptsRes.data || []);
      } else {
        console.error('Failed to fetch receipts:', receiptsRes.error);
      }

      if (categoriesRes.success) {
        setCategories(categoriesRes.data || []);
      } else {
        console.error('Failed to fetch categories:', categoriesRes.error);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load data';
      setError(errorMessage);
      showToast({
        type: 'error',
        title: 'Error',
        message: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExpenseAdded = (expense: Expense) => {
    setExpenses(prev => [expense, ...prev]);
  };

  const handleExpenseUpdated = (updatedExpense: Expense) => {
    setExpenses(prev => 
      prev.map(expense => 
        expense.id === updatedExpense.id ? updatedExpense : expense
      )
    );
  };

  const handleExpenseDeleted = (expenseId: string) => {
    setExpenses(prev => prev.filter(expense => expense.id !== expenseId));
  };

  const handleReceiptProcessed = (receipt: Receipt) => {
    setReceipts(prev => prev.map(r => r.id === receipt.id ? receipt : r));
  };

  if (loading) {
    return (
      <div className="app loading">
        <div className="loading-spinner"></div>
        <p>Loading expense tracker...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app error">
        <div className="error-container">
          <h2>Unable to load data</h2>
          <p>{error}</p>
          <button className="button primary" onClick={fetchData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="app-nav">
        <h1>Expense Tracker</h1>
        <div className="nav-tabs">
          <button
            className={activeTab === 'dashboard' ? 'active' : ''}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={activeTab === 'analytics' ? 'active' : ''}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
          <button
            className={activeTab === 'assistant' ? 'active' : ''}
            onClick={() => setActiveTab('assistant')}
          >
            AI Assistant
          </button>
        </div>
      </nav>

      <main className="app-main">
        {activeTab === 'dashboard' && (
          <UnifiedDashboard 
            expenses={expenses} 
            receipts={receipts}
            categories={categories} 
            onExpenseAdded={handleExpenseAdded}
            onExpenseUpdated={handleExpenseUpdated} 
            onExpenseDeleted={handleExpenseDeleted}
            onReceiptProcessed={handleReceiptProcessed}
          />
        )}
        {activeTab === 'analytics' && (
          <Analysis 
            expenses={expenses}
            categories={categories}
          />
        )}
        {activeTab === 'assistant' && (
          <AIAssistant 
            expenses={expenses}
            categories={categories}
          />
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastContainer>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </ToastContainer>
  );
};

export default App;