import React from 'react';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface TopVendor {
  vendor: string;
  total: number;
  count: number;
}

interface TopVendorsChartProps {
  data: TopVendor[];
}

const TopVendorsChart: React.FC<TopVendorsChartProps> = ({ data }) => {
  const { theme } = useTheme();
  
  // Generate colors for bars
  const generateBarColors = (count: number) => {
    const colors = [
      theme === 'dark' ? '#4a9eff' : '#007bff',
      theme === 'dark' ? '#48c764' : '#28a745',
      theme === 'dark' ? '#ffc107' : '#ffc107',
      theme === 'dark' ? '#e74c3c' : '#dc3545',
      theme === 'dark' ? '#36cff4' : '#17a2b8',
      theme === 'dark' ? '#9b59b6' : '#6f42c1',
      theme === 'dark' ? '#f39c12' : '#fd7e14',
      theme === 'dark' ? '#e67e22' : '#e83e8c',
      theme === 'dark' ? '#2ecc71' : '#20c997',
      theme === 'dark' ? '#34495e' : '#6c757d'
    ];
    
    return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
  };

  const chartData = {
    labels: data.map(item => item.vendor),
    datasets: [
      {
        label: 'Total Spent',
        data: data.map(item => item.total),
        backgroundColor: generateBarColors(data.length),
        borderColor: generateBarColors(data.length).map(color => 
          color.replace('0.8', '1')
        ),
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }
    ]
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false // Hide legend for bar chart
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#2d2d2d' : '#ffffff',
        titleColor: theme === 'dark' ? '#e0e0e0' : '#333333',
        bodyColor: theme === 'dark' ? '#b0b0b0' : '#666666',
        borderColor: theme === 'dark' ? '#404040' : '#e0e0e0',
        borderWidth: 1,
        callbacks: {
          title: (context) => {
            const item = data[context[0].dataIndex];
            return `🏪 ${item.vendor}`;
          },
          label: (context) => {
            const item = data[context.dataIndex];
            return [
              `💰 Total: $${item.total.toFixed(2)}`,
              `📊 Purchases: ${item.count}`,
              `📈 Avg/Purchase: $${(item.total / item.count).toFixed(2)}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Vendors',
          color: theme === 'dark' ? '#e0e0e0' : '#333333'
        },
        ticks: {
          color: theme === 'dark' ? '#b0b0b0' : '#666666',
          maxRotation: 45,
          minRotation: 0
        },
        grid: {
          color: theme === 'dark' ? '#404040' : '#e0e0e0'
        }
      },
      y: {
        display: true,
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
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart'
    }
  };

  return (
    <div className="chart-container">
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default TopVendorsChart;