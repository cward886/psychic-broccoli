import React, { useState, useEffect } from 'react';
import { Expense, Category } from '../../shared/types';

interface FilterOptions {
  dateRange: {
    start: string;
    end: string;
  };
  categories: string[];
  vendors: string[];
  amountRange: {
    min: number;
    max: number;
  };
  timeFrame: 'all' | 'year' | 'month' | 'week' | 'custom';
}

interface FilterPanelProps {
  expenses: Expense[];
  categories: Category[];
  onFilterChange: (filteredExpenses: Expense[], filters: FilterOptions) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ expenses, categories, onFilterChange }) => {
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: {
      start: '',
      end: ''
    },
    categories: [],
    vendors: [],
    amountRange: {
      min: 0,
      max: 0
    },
    timeFrame: 'all'
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [availableVendors, setAvailableVendors] = useState<string[]>([]);
  const [maxAmount, setMaxAmount] = useState(0);

  useEffect(() => {
    // Initialize available vendors and max amount
    const vendors = [...new Set(expenses.map(e => e.vendor).filter((v): v is string => v != null && v.trim() !== ''))];
    setAvailableVendors(vendors.sort());
    
    const amounts = expenses.map(e => e.amount);
    const maxAmt = amounts.length > 0 ? Math.max(...amounts) : 0;
    setMaxAmount(maxAmt);
    
    setFilters(prev => ({
      ...prev,
      amountRange: {
        min: 0,
        max: maxAmt
      }
    }));
  }, [expenses]);

  useEffect(() => {
    applyFilters();
  }, [filters, expenses]);

  const applyFilters = () => {
    let filtered = [...expenses];

    // Apply date range filter
    if (filters.timeFrame !== 'all') {
      const now = new Date();
      let startDate: Date;
      
      switch (filters.timeFrame) {
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'custom':
          if (filters.dateRange.start) {
            startDate = new Date(filters.dateRange.start);
          } else {
            startDate = new Date(0);
          }
          break;
        default:
          startDate = new Date(0);
      }

      const endDate = filters.timeFrame === 'custom' && filters.dateRange.end 
        ? new Date(filters.dateRange.end) 
        : now;

      filtered = filtered.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startDate && expenseDate <= endDate;
      });
    }

    // Apply category filter
    if (filters.categories.length > 0) {
      filtered = filtered.filter(expense => filters.categories.includes(expense.category));
    }

    // Apply vendor filter
    if (filters.vendors.length > 0) {
      filtered = filtered.filter(expense => 
        expense.vendor && filters.vendors.includes(expense.vendor)
      );
    }

    // Apply amount range filter
    filtered = filtered.filter(expense => 
      expense.amount >= filters.amountRange.min && expense.amount <= filters.amountRange.max
    );

    onFilterChange(filtered, filters);
  };

  const handleTimeFrameChange = (timeFrame: FilterOptions['timeFrame']) => {
    setFilters(prev => ({
      ...prev,
      timeFrame,
      dateRange: timeFrame === 'custom' ? prev.dateRange : { start: '', end: '' }
    }));
  };

  const handleCategoryToggle = (categoryId: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(categoryId)
        ? prev.categories.filter(id => id !== categoryId)
        : [...prev.categories, categoryId]
    }));
  };

  const handleVendorToggle = (vendor: string) => {
    setFilters(prev => ({
      ...prev,
      vendors: prev.vendors.includes(vendor)
        ? prev.vendors.filter(v => v !== vendor)
        : [...prev.vendors, vendor]
    }));
  };

  const handleAmountRangeChange = (min: number, max: number) => {
    setFilters(prev => ({
      ...prev,
      amountRange: { min, max }
    }));
  };

  const handleDateRangeChange = (start: string, end: string) => {
    setFilters(prev => ({
      ...prev,
      dateRange: { start, end }
    }));
  };

  const clearFilters = () => {
    setFilters({
      dateRange: { start: '', end: '' },
      categories: [],
      vendors: [],
      amountRange: { min: 0, max: maxAmount },
      timeFrame: 'all'
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.timeFrame !== 'all') count++;
    if (filters.categories.length > 0) count++;
    if (filters.vendors.length > 0) count++;
    if (filters.amountRange.min > 0 || filters.amountRange.max < maxAmount) count++;
    return count;
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
  };

  const getCategoryIcon = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.icon : '📋';
  };

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.color : '#6c757d';
  };

  return (
    <div className="filter-panel">
      <div className="filter-header">
        <button 
          className="filter-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span>Filters</span>
          {getActiveFilterCount() > 0 && (
            <span className="filter-count">{getActiveFilterCount()}</span>
          )}
          <span className={`filter-arrow ${isExpanded ? 'expanded' : ''}`}>▼</span>
        </button>
        {getActiveFilterCount() > 0 && (
          <button className="clear-filters" onClick={clearFilters}>
            Clear All
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="filter-content">
          {/* Time Frame Filter */}
          <div className="filter-section">
            <h4>Time Frame</h4>
            <div className="filter-options">
              {(['all', 'year', 'month', 'week', 'custom'] as const).map(timeFrame => (
                <button
                  key={timeFrame}
                  className={`filter-option ${filters.timeFrame === timeFrame ? 'active' : ''}`}
                  onClick={() => handleTimeFrameChange(timeFrame)}
                >
                  {timeFrame.charAt(0).toUpperCase() + timeFrame.slice(1)}
                </button>
              ))}
            </div>
            {filters.timeFrame === 'custom' && (
              <div className="date-range">
                <div className="date-input">
                  <label>Start Date:</label>
                  <input
                    type="date"
                    value={filters.dateRange.start}
                    onChange={(e) => handleDateRangeChange(e.target.value, filters.dateRange.end)}
                  />
                </div>
                <div className="date-input">
                  <label>End Date:</label>
                  <input
                    type="date"
                    value={filters.dateRange.end}
                    onChange={(e) => handleDateRangeChange(filters.dateRange.start, e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Category Filter */}
          <div className="filter-section">
            <h4>Categories</h4>
            <div className="filter-checkbox-grid">
              {categories.map(category => (
                <label key={category.id} className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(category.id)}
                    onChange={() => handleCategoryToggle(category.id)}
                  />
                  <span 
                    className="category-badge"
                    style={{ backgroundColor: category.color }}
                  >
                    {category.icon} {category.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Vendor Filter */}
          {availableVendors.length > 0 && (
            <div className="filter-section">
              <h4>Vendors</h4>
              <div className="filter-checkbox-grid">
                {availableVendors.map(vendor => (
                  <label key={vendor} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={filters.vendors.includes(vendor)}
                      onChange={() => handleVendorToggle(vendor)}
                    />
                    <span className="vendor-badge">{vendor}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Amount Range Filter */}
          <div className="filter-section">
            <h4>Amount Range</h4>
            <div className="amount-range">
              <div className="range-inputs">
                <div className="range-input">
                  <label>Min: $</label>
                  <input
                    type="number"
                    min="0"
                    max={maxAmount}
                    step="0.01"
                    value={filters.amountRange.min}
                    onChange={(e) => handleAmountRangeChange(parseFloat(e.target.value) || 0, filters.amountRange.max)}
                  />
                </div>
                <div className="range-input">
                  <label>Max: $</label>
                  <input
                    type="number"
                    min="0"
                    max={maxAmount}
                    step="0.01"
                    value={filters.amountRange.max}
                    onChange={(e) => handleAmountRangeChange(filters.amountRange.min, parseFloat(e.target.value) || maxAmount)}
                  />
                </div>
              </div>
              <div className="range-slider">
                <input
                  type="range"
                  min="0"
                  max={maxAmount}
                  step="0.01"
                  value={filters.amountRange.min}
                  onChange={(e) => handleAmountRangeChange(parseFloat(e.target.value), filters.amountRange.max)}
                  className="range-min"
                />
                <input
                  type="range"
                  min="0"
                  max={maxAmount}
                  step="0.01"
                  value={filters.amountRange.max}
                  onChange={(e) => handleAmountRangeChange(filters.amountRange.min, parseFloat(e.target.value))}
                  className="range-max"
                />
              </div>
              <div className="range-display">
                ${filters.amountRange.min.toFixed(2)} - ${filters.amountRange.max.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;