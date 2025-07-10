import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Expense } from '../../../shared/types';

interface HeatmapChartProps {
  data: Expense[];
}

const HeatmapChart: React.FC<HeatmapChartProps> = ({ data }) => {
  const { theme } = useTheme();

  // Create a 7x24 grid for day of week x hour of day
  const generateHeatmapData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    // Initialize grid with zeros
    const grid = days.map(() => Array(24).fill(0));
    const amountGrid = days.map(() => Array(24).fill(0));
    
    // Count expenses by day of week and hour
    data.forEach(expense => {
      const date = new Date(expense.date + 'T12:00:00'); // Assume noon for expenses without time
      const dayOfWeek = date.getDay();
      const hour = date.getHours();
      
      grid[dayOfWeek][hour]++;
      amountGrid[dayOfWeek][hour] += expense.amount;
    });
    
    // Find max values for scaling
    const maxCount = Math.max(...grid.flat());
    const maxAmount = Math.max(...amountGrid.flat());
    
    return {
      grid,
      amountGrid,
      maxCount,
      maxAmount,
      days,
      hours
    };
  };

  const { grid, amountGrid, maxCount, maxAmount, days, hours } = generateHeatmapData();

  const getIntensity = (count: number, amount: number) => {
    if (count === 0) return 0;
    // Use both count and amount for intensity calculation
    const countIntensity = count / maxCount;
    const amountIntensity = amount / maxAmount;
    return Math.max(countIntensity, amountIntensity * 0.7); // Weight amount slightly less
  };

  const getColor = (intensity: number) => {
    if (intensity === 0) return theme === 'dark' ? '#1a1a1a' : '#f8f9fa';
    
    const baseColor = theme === 'dark' ? [74, 158, 255] : [0, 123, 255]; // Blue
    const alpha = Math.min(intensity, 1);
    
    return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${alpha})`;
  };

  return (
    <div className="heatmap-chart">
      <div className="heatmap-container">
        <div className="heatmap-grid">
          {/* Day labels */}
          <div className="day-labels">
            {days.map(day => (
              <div key={day} className="day-label">{day}</div>
            ))}
          </div>
          
          {/* Hour labels */}
          <div className="hour-labels">
            {hours.filter((_, i) => i % 4 === 0).map(hour => (
              <div key={hour} className="hour-label">{hour}:00</div>
            ))}
          </div>
          
          {/* Heatmap cells */}
          <div className="heatmap-cells">
            {grid.map((dayRow, dayIndex) => (
              <div key={dayIndex} className="heatmap-row">
                {dayRow.map((count, hourIndex) => {
                  const amount = amountGrid[dayIndex][hourIndex];
                  const intensity = getIntensity(count, amount);
                  
                  return (
                    <div
                      key={`${dayIndex}-${hourIndex}`}
                      className="heatmap-cell"
                      style={{
                        backgroundColor: getColor(intensity),
                        border: `1px solid ${theme === 'dark' ? '#404040' : '#e0e0e0'}`
                      }}
                      title={`${days[dayIndex]} ${hours[hourIndex]}:00 - ${count} expenses, $${amount.toFixed(2)}`}
                    >
                      {count > 0 && (
                        <div className="cell-content">
                          <div className="cell-count">{count}</div>
                          {amount > 0 && (
                            <div className="cell-amount">${amount.toFixed(0)}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        
        {/* Legend */}
        <div className="heatmap-legend">
          <div className="legend-label">Activity Level</div>
          <div className="legend-scale">
            <div className="legend-item">
              <div 
                className="legend-color"
                style={{ backgroundColor: getColor(0) }}
              />
              <span>None</span>
            </div>
            <div className="legend-item">
              <div 
                className="legend-color"
                style={{ backgroundColor: getColor(0.25) }}
              />
              <span>Low</span>
            </div>
            <div className="legend-item">
              <div 
                className="legend-color"
                style={{ backgroundColor: getColor(0.5) }}
              />
              <span>Medium</span>
            </div>
            <div className="legend-item">
              <div 
                className="legend-color"
                style={{ backgroundColor: getColor(0.75) }}
              />
              <span>High</span>
            </div>
            <div className="legend-item">
              <div 
                className="legend-color"
                style={{ backgroundColor: getColor(1) }}
              />
              <span>Very High</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Summary Stats */}
      <div className="heatmap-stats">
        <div className="stat">
          <div className="stat-label">Most Active Day</div>
          <div className="stat-value">
            {(() => {
              const dayTotals = grid.map(row => row.reduce((sum, count) => sum + count, 0));
              const maxDayIndex = dayTotals.indexOf(Math.max(...dayTotals));
              return days[maxDayIndex];
            })()}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Peak Activity</div>
          <div className="stat-value">
            {(() => {
              let maxCount = 0;
              let maxDay = '';
              let maxHour = 0;
              
              grid.forEach((dayRow, dayIndex) => {
                dayRow.forEach((count, hourIndex) => {
                  if (count > maxCount) {
                    maxCount = count;
                    maxDay = days[dayIndex];
                    maxHour = hourIndex;
                  }
                });
              });
              
              return maxCount > 0 ? `${maxDay} ${maxHour}:00` : 'No data';
            })()}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Total Data Points</div>
          <div className="stat-value">{data.length}</div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapChart;