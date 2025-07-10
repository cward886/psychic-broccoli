import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { useTheme } from '../../contexts/ThemeContext';
import { Expense } from '../../../shared/types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface ComparisonChartProps {
  data: Expense[];
}

type ComparisonType = 'month' | 'quarter' | 'year';

const ComparisonChart: React.FC<ComparisonChartProps> = ({ data }) => {
  const { theme } = useTheme();
  const [comparisonType, setComparisonType] = useState<ComparisonType>('month');
  
  const generateComparisonData = () => {
    const now = new Date();
    const currentPeriod = getCurrentPeriod(now);
    const previousPeriod = getPreviousPeriod(now);
    
    const currentData = data.filter(expense => 
      isInPeriod(new Date(expense.date), currentPeriod)
    );
    
    const previousData = data.filter(expense => 
      isInPeriod(new Date(expense.date), previousPeriod)
    );
    
    return {
      current: {
        period: formatPeriod(currentPeriod),
        data: currentData,
        total: currentData.reduce((sum, e) => sum + e.amount, 0),
        count: currentData.length
      },
      previous: {
        period: formatPeriod(previousPeriod),
        data: previousData,
        total: previousData.reduce((sum, e) => sum + e.amount, 0),
        count: previousData.length
      }
    };
  };
  
  const getCurrentPeriod = (date: Date) => {
    switch (comparisonType) {
      case 'month':
        return {
          start: new Date(date.getFullYear(), date.getMonth(), 1),
          end: new Date(date.getFullYear(), date.getMonth() + 1, 0)
        };
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3);
        return {
          start: new Date(date.getFullYear(), quarter * 3, 1),
          end: new Date(date.getFullYear(), (quarter + 1) * 3, 0)
        };
      case 'year':
        return {
          start: new Date(date.getFullYear(), 0, 1),
          end: new Date(date.getFullYear(), 11, 31)
        };
    }
  };
  
  const getPreviousPeriod = (date: Date) => {
    switch (comparisonType) {
      case 'month':
        const prevMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
        return {
          start: prevMonth,
          end: new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0)
        };
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3);
        const prevQuarter = quarter === 0 ? 3 : quarter - 1;
        const prevYear = quarter === 0 ? date.getFullYear() - 1 : date.getFullYear();
        return {
          start: new Date(prevYear, prevQuarter * 3, 1),
          end: new Date(prevYear, (prevQuarter + 1) * 3, 0)
        };
      case 'year':
        return {
          start: new Date(date.getFullYear() - 1, 0, 1),
          end: new Date(date.getFullYear() - 1, 11, 31)
        };
    }
  };
  
  const isInPeriod = (date: Date, period: { start: Date; end: Date }) => {
    return date >= period.start && date <= period.end;
  };
  
  const formatPeriod = (period: { start: Date; end: Date }) => {
    const options: Intl.DateTimeFormatOptions = 
      comparisonType === 'year' 
        ? { year: 'numeric' }
        : comparisonType === 'quarter'
        ? { year: 'numeric', month: 'short' }
        : { year: 'numeric', month: 'long' };
    
    return period.start.toLocaleDateString('en-US', options);
  };
  
  const { current, previous } = generateComparisonData();
  
  // Calculate category breakdown for comparison
  const getCategoryBreakdown = (expenses: Expense[]) => {
    const categories = new Map<string, number>();
    expenses.forEach(expense => {
      const current = categories.get(expense.category) || 0;
      categories.set(expense.category, current + expense.amount);
    });
    return Array.from(categories.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10); // Top 10 categories
  };
  
  const currentCategories = getCategoryBreakdown(current.data);
  const previousCategories = getCategoryBreakdown(previous.data);
  
  const allCategories = [...new Set([
    ...currentCategories.map(([cat]) => cat),
    ...previousCategories.map(([cat]) => cat)
  ])];
  
  const chartData = {
    labels: allCategories.map(cat => cat.substring(0, 15) + (cat.length > 15 ? '...' : '')),
    datasets: [
      {
        label: current.period,
        data: allCategories.map(cat => {
          const found = currentCategories.find(([c]) => c === cat);
          return found ? found[1] : 0;
        }),
        backgroundColor: theme === 'dark' ? 'rgba(74, 158, 255, 0.8)' : 'rgba(0, 123, 255, 0.8)',
        borderColor: theme === 'dark' ? '#4a9eff' : '#007bff',
        borderWidth: 1
      },
      {
        label: previous.period,
        data: allCategories.map(cat => {
          const found = previousCategories.find(([c]) => c === cat);
          return found ? found[1] : 0;
        }),
        backgroundColor: theme === 'dark' ? 'rgba(255, 159, 64, 0.8)' : 'rgba(255, 193, 7, 0.8)',
        borderColor: theme === 'dark' ? '#ff9f40' : '#ffc107',
        borderWidth: 1
      }
    ]
  };
  
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: theme === 'dark' ? '#e0e0e0' : '#333333'
        }
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#2d2d2d' : '#ffffff',
        titleColor: theme === 'dark' ? '#e0e0e0' : '#333333',
        bodyColor: theme === 'dark' ? '#b0b0b0' : '#666666',
        borderColor: theme === 'dark' ? '#404040' : '#e0e0e0',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: theme === 'dark' ? '#b0b0b0' : '#666666'
        },
        grid: {
          color: theme === 'dark' ? '#404040' : '#e0e0e0'
        }
      },
      y: {
        ticks: {
          color: theme === 'dark' ? '#b0b0b0' : '#666666',
          callback: function(value) {
            return '$' + Number(value).toFixed(0);
          }
        },
        grid: {
          color: theme === 'dark' ? '#404040' : '#e0e0e0'
        }
      }
    }
  };
  
  const getChangePercentage = () => {
    if (previous.total === 0) return current.total > 0 ? 100 : 0;
    return ((current.total - previous.total) / previous.total) * 100;
  };
  
  const getChangeColor = () => {
    const change = getChangePercentage();
    if (change > 0) return '#dc3545'; // Red for increase
    if (change < 0) return '#28a745'; // Green for decrease
    return theme === 'dark' ? '#e0e0e0' : '#333333'; // Neutral for no change
  };

  return (
    <div className="comparison-chart">
      <div className="comparison-header">
        <h3>Period Comparison</h3>
        <div className="comparison-controls">
          {(['month', 'quarter', 'year'] as ComparisonType[]).map(type => (
            <button
              key={type}
              className={`comparison-btn ${comparisonType === type ? 'active' : ''}`}
              onClick={() => setComparisonType(type)}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      <div className="comparison-summary">
        <div className="period-card">
          <div className="period-title">{current.period}</div>
          <div className="period-amount">${current.total.toFixed(2)}</div>
          <div className="period-count">{current.count} expenses</div>
        </div>
        
        <div className="comparison-arrow">
          <div className="arrow-icon">
            {getChangePercentage() > 0 ? '↗' : getChangePercentage() < 0 ? '↘' : '→'}
          </div>
          <div className="change-percentage" style={{ color: getChangeColor() }}>
            {getChangePercentage() > 0 ? '+' : ''}{getChangePercentage().toFixed(1)}%
          </div>
        </div>
        
        <div className="period-card">
          <div className="period-title">{previous.period}</div>
          <div className="period-amount">${previous.total.toFixed(2)}</div>
          <div className="period-count">{previous.count} expenses</div>
        </div>
      </div>
      
      <div className="chart-container">
        <Bar data={chartData} options={options} />
      </div>
      
      <div className="comparison-insights">
        <div className="insight">
          <strong>Total Change:</strong> ${(current.total - previous.total).toFixed(2)}
        </div>
        <div className="insight">
          <strong>Transaction Change:</strong> {current.count - previous.count} expenses
        </div>
        <div className="insight">
          <strong>Average per Transaction:</strong> 
          <span className="current">${current.count > 0 ? (current.total / current.count).toFixed(2) : '0.00'}</span>
          vs
          <span className="previous">${previous.count > 0 ? (previous.total / previous.count).toFixed(2) : '0.00'}</span>
        </div>
      </div>
    </div>
  );
};

export default ComparisonChart;