import React, { useState, useEffect } from 'react';
import { api } from '../services/ipc-service';

interface ReceiptData {
  id: string;
  filename: string;
  original_path: string;
  processed_path?: string;
  ocr_text?: string;
  extracted_data?: string;
  status: string;
  created_at: string;
  expense_description?: string;
  expense_amount?: number;
}

interface ReceiptViewerProps {
  expenseId: string;
  onClose: () => void;
}

const ReceiptViewer: React.FC<ReceiptViewerProps> = ({ expenseId, onClose }) => {
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReceipt();
  }, [expenseId]);

  const fetchReceipt = async () => {
    try {
      const result = await api.receipts.getForExpense(expenseId);
      
      if (result.success && result.data) {
        setReceipt(result.data as any);
      } else {
        setError(result.error || 'Failed to load receipt');
      }
    } catch (error) {
      setError('Failed to load receipt');
      console.error('Error fetching receipt:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  if (loading) {
    return (
      <div className="receipt-viewer-overlay">
        <div className="receipt-viewer">
          <div className="loading">Loading receipt...</div>
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="receipt-viewer-overlay">
        <div className="receipt-viewer">
          <div className="receipt-header">
            <h3>Receipt Not Found</h3>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="error">{error || 'No receipt found for this expense'}</div>
        </div>
      </div>
    );
  }

  const extractedData = receipt.extracted_data ? JSON.parse(receipt.extracted_data) : null;

  return (
    <div className="receipt-viewer-overlay" onClick={onClose}>
      <div className="receipt-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-header">
          <h3>Receipt Details</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="receipt-content">
          <div className="receipt-info">
            <div className="info-row">
              <span className="label">Filename:</span>
              <span className="value">{receipt.filename}</span>
            </div>
            <div className="info-row">
              <span className="label">Upload Date:</span>
              <span className="value">{formatDate(receipt.created_at)}</span>
            </div>
            <div className="info-row">
              <span className="label">Status:</span>
              <span className={`status ${receipt.status}`}>{receipt.status}</span>
            </div>
            {receipt.expense_amount && (
              <div className="info-row">
                <span className="label">Expense Amount:</span>
                <span className="value amount">{formatCurrency(receipt.expense_amount)}</span>
              </div>
            )}
          </div>

          {extractedData && (
            <div className="extracted-data">
              <h4>Extracted Information</h4>
              <div className="extracted-fields">
                {extractedData.vendor && (
                  <div className="field">
                    <span className="field-label">Vendor:</span>
                    <span className="field-value">{extractedData.vendor}</span>
                  </div>
                )}
                {extractedData.amount && (
                  <div className="field">
                    <span className="field-label">Amount:</span>
                    <span className="field-value">{formatCurrency(extractedData.amount)}</span>
                  </div>
                )}
                {extractedData.date && (
                  <div className="field">
                    <span className="field-label">Date:</span>
                    <span className="field-value">{extractedData.date}</span>
                  </div>
                )}
                {extractedData.items && extractedData.items.length > 0 && (
                  <div className="field">
                    <span className="field-label">Items ({extractedData.items.length}):</span>
                    <div className="items-list">
                      {extractedData.items.map((item: any, index: number) => (
                        <div key={index} className="item-row">
                          <span className="item-description">{item.description}</span>
                          <span className="item-quantity">
                            {item.quantity && item.quantity > 1 ? `x${item.quantity}` : ''}
                          </span>
                          <span className="item-price">{formatCurrency(item.price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {receipt.ocr_text && (
            <div className="ocr-text">
              <h4>Raw OCR Text</h4>
              <div className="ocr-content">
                <pre>{receipt.ocr_text}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceiptViewer;