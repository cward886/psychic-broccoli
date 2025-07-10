import React from 'react';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { useTheme } from '../../contexts/ThemeContext';

ChartJS.register(ArcElement, Tooltip, Legend);

interface CategorySpending {
  name: string;
  color: string;
  icon: string;
  total: number;
  count: number;
}

interface CategoryPieChartProps {
  data: CategorySpending[];
}

const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ data }) => {
  const { theme } = useTheme();
  
  const chartData = {
    labels: data.map(item => item.name),
    datasets: [
      {
        data: data.map(item => item.total),
        backgroundColor: data.map(item => item.color),
        borderColor: theme === 'dark' ? '#404040' : '#ffffff',
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverBorderColor: theme === 'dark' ? '#666666' : '#e0e0e0',
      }
    ]
  };

  const options: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: theme === 'dark' ? '#e0e0e0' : '#333333',
          font: {
            size: 12
          },
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
          generateLabels: (chart) => {
            const original = ChartJS.defaults.plugins.legend.labels.generateLabels;
            const labels = original?.call(this, chart) || [];
            
            return labels.map((label, index) => ({
              ...label,
              text: `${data[index]?.icon || ''} ${label.text} ($${data[index]?.total.toFixed(2) || '0.00'})`
            }));
          }
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
            const item = data[context.dataIndex];
            const percentage = ((item.total / data.reduce((sum, d) => sum + d.total, 0)) * 100).toFixed(1);
            return [
              `${item.icon} ${item.name}`,
              `Amount: $${item.total.toFixed(2)}`,
              `Purchases: ${item.count}`,
              `Percentage: ${percentage}%`
            ];
          }
        }
      }
    },
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 1000
    }
  };

  return (
    <div className="chart-container">
      <Pie data={chartData} options={options} />
    </div>
  );
};

export default CategoryPieChart;