import React, { useState } from 'react';
import { api, downloadExportedData } from '../services/ipc-service';

const DataExport: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true);
    
    try {
      const result = await api.export.data(format);
      
      if (result.success && result.data) {
        downloadExportedData(result.data.data, result.data.filename);
      } else {
        throw new Error(result.error || 'Export failed');
      }
      
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="data-export">
      <h3>Export Data</h3>
      <p>Download your expense data for backup or analysis in external tools.</p>
      
      <div className="export-options">
        <div className="export-option">
          <div className="export-format">
            <h4>📊 CSV Format</h4>
            <p>Export expenses in CSV format for use with Excel, Google Sheets, or other spreadsheet applications.</p>
          </div>
          <button 
            className="button primary"
            onClick={() => handleExport('csv')}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>

        <div className="export-option">
          <div className="export-format">
            <h4>💾 JSON Format</h4>
            <p>Export complete database backup including expenses, categories, and receipts in JSON format.</p>
          </div>
          <button 
            className="button secondary"
            onClick={() => handleExport('json')}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export JSON'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataExport;