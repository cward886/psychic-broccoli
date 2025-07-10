import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';
import { useTheme } from '../../contexts/ThemeContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MonthlySpending {
  month: string;
  total: number;
  count: number;
}

interface MonthlyTrendChartProps {
  data: MonthlySpending[];
}

const MonthlyTrendChart: React.FC<MonthlyTrendChartProps> = ({ data }) => {
  const { theme } = useTheme();
  
  const formatMonth = (month: string) => {
    const date = new Date(month + '-01');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  };

  const chartData = {
    labels: data.map(item => formatMonth(item.month)),
    datasets: [
      {
        label: 'Monthly Spending',
        data: data.map(item => item.total),
        borderColor: theme === 'dark' ? '#4a9eff' : '#007bff',
        backgroundColor: theme === 'dark' ? 'rgba(74, 158, 255, 0.1)' : 'rgba(0, 123, 255, 0.1)',
        pointBackgroundColor: theme === 'dark' ? '#4a9eff' : '#007bff',
        pointBorderColor: theme === 'dark' ? '#ffffff' : '#ffffff',
        pointHoverBackgroundColor: theme === 'dark' ? '#2b7ce8' : '#0056b3',
        pointHoverBorderColor: theme === 'dark' ? '#ffffff' : '#ffffff',
        pointRadius: 6,
        pointHoverRadius: 8,
        borderWidth: 3,
        fill: true,
        tension: 0.4
      },
      {
        label: 'Transaction Count',
        data: data.map(item => item.count),
        borderColor: theme === 'dark' ? '#48c764' : '#28a745',
        backgroundColor: theme === 'dark' ? 'rgba(72, 199, 100, 0.1)' : 'rgba(40, 167, 69, 0.1)',
        pointBackgroundColor: theme === 'dark' ? '#48c764' : '#28a745',
        pointBorderColor: theme === 'dark' ? '#ffffff' : '#ffffff',
        pointHoverBackgroundColor: theme === 'dark' ? '#36a552' : '#1e7e34',
        pointHoverBorderColor: theme === 'dark' ? '#ffffff' : '#ffffff',
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        yAxisID: 'y1'
      }
    ]
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: theme === 'dark' ? '#e0e0e0' : '#333333',
          font: {
            size: 12
          },
          padding: 20,
          usePointStyle: true
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
            const dataset = context.dataset;
            const value = context.parsed.y;
            
            if (dataset.label === 'Monthly Spending') {
              return `💰 Spending: $${value.toFixed(2)}`;
            } else {
              return `📊 Transactions: ${value}`;
            }
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Month',
          color: theme === 'dark' ? '#e0e0e0' : '#333333'
        },
        ticks: {
          color: theme === 'dark' ? '#b0b0b0' : '#666666'
        },
        grid: {
          color: theme === 'dark' ? '#404040' : '#e0e0e0'
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Amount ($)',
          color: theme === 'dark' ? '#e0e0e0' : '#333333'
        },
        ticks: {
          color: theme === 'dark' ? '#b0b0b0' : '#666666',
          callback: function(value) {
            return '$' + Number(value).toFixed(0);
          }
        },
        grid: {
          color: theme === 'dark' ? '#404040' : '#e0e0e0'
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Transaction Count',
          color: theme === 'dark' ? '#e0e0e0' : '#333333'
        },
        ticks: {
          color: theme === 'dark' ? '#b0b0b0' : '#666666'
        },
        grid: {
          drawOnChartArea: false,
          color: theme === 'dark' ? '#404040' : '#e0e0e0'
        }
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart'
    }
  };

  return (
    <div className="chart-container">
      <Line data={chartData} options={options} />
    </div>
  );
};

export default MonthlyTrendChart;