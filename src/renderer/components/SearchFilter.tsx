import React, { useState, useEffect } from 'react';
import { Expense, Category } from '../../shared/types';

interface SearchFilterProps {
  expenses: Expense[];
  categories: Category[];
  onFilteredResults: (results: Expense[]) => void;
}

interface FilterState {
  searchTerm: string;
  selectedCategories: string[];
  selectedVendors: string[];
  minAmount: string;
  maxAmount: string;
  startDate: string;
  endDate: string;
  sortBy: 'date' | 'amount' | 'vendor' | 'category';
  sortOrder: 'asc' | 'desc';
}

const SearchFilter: React.FC<SearchFilterProps> = ({ 
  expenses, 
  categories, 
  onFilteredResults 
}) => {
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    selectedCategories: [],
    selectedVendors: [],
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: '',
    sortBy: 'date',
    sortOrder: 'desc'
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [availableVendors, setAvailableVendors] = useState<string[]>([]);

  useEffect(() => {
    // Get unique vendors from expenses
    const vendors = Array.from(new Set(expenses.map(e => e.vendor).filter((v): v is string => Boolean(v))));
    setAvailableVendors(vendors.sort());
  }, [expenses]);

  useEffect(() => {
    applyFilters();
  }, [filters, expenses]);

  const applyFilters = () => {
    let filtered = [...expenses];

    // Search term filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(expense => 
        expense.description.toLowerCase().includes(searchLower) ||
        expense.vendor?.toLowerCase().includes(searchLower) ||
        expense.amount.toString().includes(searchLower)
      );
    }

    // Category filter
    if (filters.selectedCategories.length > 0) {
      filtered = filtered.filter(expense => 
        filters.selectedCategories.includes(expense.category)
      );
    }

    // Vendor filter
    if (filters.selectedVendors.length > 0) {
      filtered = filtered.filter(expense => 
        expense.vendor && filters.selectedVendors.includes(expense.vendor)
      );
    }

    // Amount range filter
    if (filters.minAmount) {
      const min = parseFloat(filters.minAmount);
      filtered = filtered.filter(expense => expense.amount >= min);
    }
    if (filters.maxAmount) {
      const max = parseFloat(filters.maxAmount);
      filtered = filtered.filter(expense => expense.amount <= max);
    }

    // Date range filter
    if (filters.startDate) {
      filtered = filtered.filter(expense => expense.date >= filters.startDate);
    }
    if (filters.endDate) {
      filtered = filtered.filter(expense => expense.date <= filters.endDate);
    }

    // Sort results
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (filters.sortBy) {
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'vendor':
          aValue = a.vendor || '';
          bValue = b.vendor || '';
          break;
        case 'category':
          const categoryA = categories.find(c => c.id === a.category);
          const categoryB = categories.find(c => c.id === b.category);
          aValue = categoryA?.name || '';
          bValue = categoryB?.name || '';
          break;
        default:
          aValue = a.date;
          bValue = b.date;
      }

      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    onFilteredResults(filtered);
  };

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const toggleCategory = (categoryId: string) => {
    setFilters(prev => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(categoryId)
        ? prev.selectedCategories.filter(id => id !== categoryId)
        : [...prev.selectedCategories, categoryId]
    }));
  };

  const toggleVendor = (vendor: string) => {
    setFilters(prev => ({
      ...prev,
      selectedVendors: prev.selectedVendors.includes(vendor)
        ? prev.selectedVendors.filter(v => v !== vendor)
        : [...prev.selectedVendors, vendor]
    }));
  };

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      selectedCategories: [],
      selectedVendors: [],
      minAmount: '',
      maxAmount: '',
      startDate: '',
      endDate: '',
      sortBy: 'date',
      sortOrder: 'desc'
    });
  };

  const hasActiveFilters = filters.searchTerm || 
    filters.selectedCategories.length > 0 ||
    filters.selectedVendors.length > 0 ||
    filters.minAmount || 
    filters.maxAmount ||
    filters.startDate ||
    filters.endDate;

  return (
    <div className="search-filter">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search expenses by description, vendor, or amount..."
          value={filters.searchTerm}
          onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
          className="search-input"
        />
        <button 
          className="button secondary"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          Advanced {showAdvanced ? '▼' : '▶'}
        </button>
        {hasActiveFilters && (
          <button 
            className="button danger"
            onClick={clearFilters}
            title="Clear all filters"
          >
            Clear
          </button>
        )}
      </div>

      {showAdvanced && (
        <div className="advanced-filters">
          <div className="filter-grid">
            {/* Amount Range */}
            <div className="filter-group">
              <label>Amount Range</label>
              <div className="amount-range">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minAmount}
                  onChange={(e) => handleFilterChange('minAmount', e.target.value)}
                  step="0.01"
                />
                <span>to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxAmount}
                  onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
                  step="0.01"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="filter-group">
              <label>Date Range</label>
              <div className="date-range">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
                <span>to</span>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>
            </div>

            {/* Sort Options */}
            <div className="filter-group">
              <label>Sort By</label>
              <div className="sort-options">
                <select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                >
                  <option value="date">Date</option>
                  <option value="amount">Amount</option>
                  <option value="vendor">Vendor</option>
                  <option value="category">Category</option>
                </select>
                <select
                  value={filters.sortOrder}
                  onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
          </div>

          {/* Categories Filter */}
          <div className="filter-group">
            <label>Categories ({filters.selectedCategories.length} selected)</label>
            <div className="filter-chips">
              {categories.map(category => (
                <button
                  key={category.id}
                  className={`filter-chip ${filters.selectedCategories.includes(category.id) ? 'active' : ''}`}
                  onClick={() => toggleCategory(category.id)}
                  style={{
                    backgroundColor: filters.selectedCategories.includes(category.id) 
                      ? category.color 
                      : 'var(--bg-tertiary)'
                  }}
                >
                  {category.icon} {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Vendors Filter */}
          <div className="filter-group">
            <label>Vendors ({filters.selectedVendors.length} selected)</label>
            <div className="filter-chips">
              {availableVendors.map(vendor => (
                <button
                  key={vendor}
                  className={`filter-chip ${filters.selectedVendors.includes(vendor) ? 'active' : ''}`}
                  onClick={() => toggleVendor(vendor)}
                >
                  {vendor}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasActiveFilters && (
        <div className="active-filters">
          <span className="filter-count">
            {expenses.length} total expenses
          </span>
        </div>
      )}
    </div>
  );
};

export default SearchFilter;