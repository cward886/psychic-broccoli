import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface GaugeChartProps {
  current: number;
  target: number;
  title: string;
  color?: string;
}

const GaugeChart: React.FC<GaugeChartProps> = ({ 
  current, 
  target, 
  title, 
  color = '#007bff' 
}) => {
  const { theme } = useTheme();
  
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const radius = 90;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  // Determine color based on percentage
  const getColor = () => {
    if (percentage >= 100) return '#dc3545'; // Red for over budget
    if (percentage >= 80) return '#ffc107'; // Yellow for approaching budget
    if (percentage >= 60) return '#fd7e14'; // Orange for moderate spending
    return color; // Default/safe color
  };
  
  const getStatus = () => {
    if (percentage >= 100) return 'Over Budget';
    if (percentage >= 80) return 'Approaching Limit';
    if (percentage >= 60) return 'Moderate';
    return 'On Track';
  };
  
  const getRemainingAmount = () => {
    return Math.max(target - current, 0);
  };

  return (
    <div className="gauge-chart">
      <div className="gauge-container">
        <svg width="200" height="200" className="gauge-svg">
          {/* Background circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={theme === 'dark' ? '#404040' : '#e0e0e0'}
            strokeWidth={strokeWidth}
          />
          
          {/* Progress circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={getColor()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.5s ease-in-out',
              transform: 'rotate(-90deg)',
              transformOrigin: '100px 100px'
            }}
          />
          
          {/* Center text */}
          <text
            x="100"
            y="90"
            textAnchor="middle"
            className="gauge-percentage"
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              fill: theme === 'dark' ? '#e0e0e0' : '#333333'
            }}
          >
            {percentage.toFixed(0)}%
          </text>
          
          <text
            x="100"
            y="110"
            textAnchor="middle"
            className="gauge-current"
            style={{
              fontSize: '12px',
              fill: theme === 'dark' ? '#b0b0b0' : '#666666'
            }}
          >
            ${current.toFixed(0)}
          </text>
          
          <text
            x="100"
            y="125"
            textAnchor="middle"
            className="gauge-target"
            style={{
              fontSize: '10px',
              fill: theme === 'dark' ? '#808080' : '#888888'
            }}
          >
            of ${target.toFixed(0)}
          </text>
        </svg>
        
        <div className="gauge-info">
          <h4 className="gauge-title">{title}</h4>
          <div className="gauge-status">
            <span 
              className={`status-badge ${getStatus().toLowerCase().replace(' ', '-')}`}
              style={{ color: getColor() }}
            >
              {getStatus()}
            </span>
          </div>
        </div>
      </div>
      
      <div className="gauge-details">
        <div className="gauge-detail">
          <span className="detail-label">Spent:</span>
          <span className="detail-value">${current.toFixed(2)}</span>
        </div>
        <div className="gauge-detail">
          <span className="detail-label">Budget:</span>
          <span className="detail-value">${target.toFixed(2)}</span>
        </div>
        <div className="gauge-detail">
          <span className="detail-label">Remaining:</span>
          <span className="detail-value" style={{ color: getRemainingAmount() > 0 ? '#28a745' : '#dc3545' }}>
            ${getRemainingAmount().toFixed(2)}
          </span>
        </div>
        <div className="gauge-detail">
          <span className="detail-label">Progress:</span>
          <span className="detail-value">{percentage.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};

export default GaugeChart;