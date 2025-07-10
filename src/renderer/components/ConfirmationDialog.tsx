import React from 'react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false,
}) => {
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter') {
      onConfirm();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick} onKeyDown={handleKeyDown}>
      <div className="modal-content confirmation-dialog">
        <div className="modal-header">
          <h2>{title}</h2>
          <button 
            type="button" 
            className="modal-close" 
            onClick={onCancel}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <div className="confirmation-content">
          <div className="confirmation-message">
            {message}
          </div>
          
          <div className="confirmation-actions">
            <button 
              type="button" 
              className="button secondary" 
              onClick={onCancel}
              autoFocus
            >
              {cancelText}
            </button>
            <button 
              type="button" 
              className={`button ${isDestructive ? 'danger' : 'primary'}`}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;