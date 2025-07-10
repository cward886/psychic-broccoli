import React, { useState, useEffect } from 'react';
import { Expense, Category } from '../../shared/types';

interface CategorySpending {
  name: string;
  color: string;
  icon: string;
  total: number;
  count: number;
  percentage: number;
}

interface MonthlySpending {
  month: string;
  total: number;
  count: number;
}

interface TopVendor {
  vendor: string;
  total: number;
  count: number;
}

interface AnalysisData {
  categorySpending: CategorySpending[];
  monthlySpending: MonthlySpending[];
  topVendors: TopVendor[];
  dailyAverage: number;
  totalAmount: number;
  totalExpenses: number;
}

interface AnalysisProps {
  expenses: Expense[];
  categories: Category[];
}

const Analysis: React.FC<AnalysisProps> = ({ expenses, categories }) => {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'month' | 'week'>('all');

  useEffect(() => {
    calculateAnalysisData();
  }, [expenses, categories, selectedPeriod]);

  const filterExpensesByPeriod = (expenses: Expense[]): Expense[] => {
    if (selectedPeriod === 'all') return expenses;
    
    const now = new Date();
    const cutoffDate = new Date();
    
    if (selectedPeriod === 'month') {
      cutoffDate.setMonth(now.getMonth() - 1);
    } else if (selectedPeriod === 'week') {
      cutoffDate.setDate(now.getDate() - 7);
    }
    
    return expenses.filter(expense => new Date(expense.date) >= cutoffDate);
  };

  const calculateAnalysisData = () => {
    const filteredExpenses = filterExpensesByPeriod(expenses);
    
    if (!filteredExpenses.length) {
      setData({
        categorySpending: [],
        monthlySpending: [],
        topVendors: [],
        dailyAverage: 0,
        totalAmount: 0,
        totalExpenses: 0
      });
      setLoading(false);
      return;
    }

    // Calculate total amount
    const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Calculate category spending
    const categoryMap = new Map<string, { total: number; count: number }>();
    filteredExpenses.forEach(expense => {
      const existing = categoryMap.get(expense.category) || { total: 0, count: 0 };
      categoryMap.set(expense.category, {
        total: existing.total + expense.amount,
        count: existing.count + 1
      });
    });

    const categorySpending: CategorySpending[] = Array.from(categoryMap.entries())
      .map(([categoryId, data]) => {
        const category = categories.find(c => c.id === categoryId);
        return {
          name: category?.name || 'Unknown',
          color: category?.color || '#6c757d',
          icon: category?.icon || 'O',
          total: data.total,
          count: data.count,
          percentage: (data.total / totalAmount) * 100
        };
      })
      .sort((a, b) => b.total - a.total);

    // Calculate monthly spending
    const monthlyMap = new Map<string, { total: number; count: number }>();
    filteredExpenses.forEach(expense => {
      const month = expense.date.slice(0, 7); // YYYY-MM format
      const existing = monthlyMap.get(month) || { total: 0, count: 0 };
      monthlyMap.set(month, {
        total: existing.total + expense.amount,
        count: existing.count + 1
      });
    });

    const monthlySpending: MonthlySpending[] = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, total: data.total, count: data.count }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12); // Last 12 months

    // Calculate top vendors
    const vendorMap = new Map<string, { total: number; count: number }>();
    filteredExpenses.forEach(expense => {
      if (expense.vendor && expense.vendor !== 'Unknown') {
        const existing = vendorMap.get(expense.vendor) || { total: 0, count: 0 };
        vendorMap.set(expense.vendor, {
          total: existing.total + expense.amount,
          count: existing.count + 1
        });
      }
    });

    const topVendors: TopVendor[] = Array.from(vendorMap.entries())
      .map(([vendor, data]) => ({ vendor, total: data.total, count: data.count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Calculate daily average
    const uniqueDates = [...new Set(filteredExpenses.map(e => e.date))];
    const dailyAverage = uniqueDates.length > 0 ? totalAmount / uniqueDates.length : 0;

    setData({
      categorySpending,
      monthlySpending,
      topVendors,
      dailyAverage,
      totalAmount,
      totalExpenses: filteredExpenses.length
    });
    setLoading(false);
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatMonth = (month: string) => {
    const date = new Date(month + '-01');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="analysis loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="analysis error">
        <p>Failed to load analysis data</p>
      </div>
    );
  }

  return (
    <div className="analysis">
      {/* Header */}
      <div className="analysis-header">
        <h1>Analytics</h1>
        <div className="period-selector">
          <button 
            className={selectedPeriod === 'week' ? 'active' : ''}
            onClick={() => setSelectedPeriod('week')}
          >
            Last 7 Days
          </button>
          <button 
            className={selectedPeriod === 'month' ? 'active' : ''}
            onClick={() => setSelectedPeriod('month')}
          >
            Last 30 Days
          </button>
          <button 
            className={selectedPeriod === 'all' ? 'active' : ''}
            onClick={() => setSelectedPeriod('all')}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="stats-grid">
        <div className="stat-card glass-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Spent</div>
            <div className="stat-value">{formatCurrency(data.totalAmount)}</div>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Transactions</div>
            <div className="stat-value">{data.totalExpenses}</div>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Daily Average</div>
            <div className="stat-value">{formatCurrency(data.dailyAverage)}</div>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Avg per Transaction</div>
            <div className="stat-value">
              {formatCurrency(data.totalExpenses > 0 ? data.totalAmount / data.totalExpenses : 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="card glass-card">
        <h2>Spending by Category</h2>
        <div className="category-breakdown">
          {data.categorySpending.map((category, index) => (
            <div key={index} className="category-row">
              <div className="category-info">
                <div 
                  className="category-icon"
                  style={{ 
                    background: category.color,
                    color: 'white',
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '1.2rem'
                  }}
                >
                  {category.icon}
                </div>
                <div className="category-details">
                  <div className="category-name">{category.name}</div>
                  <div className="category-stats">
                    {category.count} transactions • {category.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="category-amount">{formatCurrency(category.total)}</div>
              <div className="category-bar-wrapper">
                <div 
                  className="category-bar" 
                  style={{ 
                    width: `${category.percentage}%`,
                    background: category.color
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="card glass-card">
        <h2>Monthly Spending Trend</h2>
        <div className="monthly-chart">
          <div className="chart-bars">
            {data.monthlySpending.map((month, index) => {
              const maxAmount = Math.max(...data.monthlySpending.map(m => m.total));
              const height = maxAmount > 0 ? (month.total / maxAmount) * 100 : 0;
              
              return (
                <div key={index} className="month-bar-container">
                  <div className="month-bar-wrapper">
                    <div className="month-amount">{formatCurrency(month.total)}</div>
                    <div 
                      className="month-bar" 
                      style={{ 
                        height: `${height}%`,
                        background: 'var(--accent-gradient)'
                      }}
                    />
                  </div>
                  <div className="month-label">{formatMonth(month.month)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Vendors */}
      <div className="card glass-card">
        <h2>Top Vendors</h2>
        <div className="vendor-list">
          {data.topVendors.length === 0 ? (
            <p className="no-data">No vendor data available</p>
          ) : (
            data.topVendors.map((vendor, index) => (
              <div key={index} className="vendor-row">
                <div className="vendor-rank">#{index + 1}</div>
                <div className="vendor-info">
                  <div className="vendor-name">{vendor.vendor}</div>
                  <div className="vendor-stats">{vendor.count} purchases</div>
                </div>
                <div className="vendor-amount">{formatCurrency(vendor.total)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Analysis;