import React, { useEffect, useState } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  message: ToastMessage;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(message.id), 300);
    }, message.duration || 5000);

    return () => clearTimeout(timer);
  }, [message.id, message.duration, onClose]);

  const getIcon = () => {
    switch (message.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  };

  return (
    <div 
      className={`toast ${message.type} ${!isVisible ? 'toast-exit' : ''}`}
      style={{ 
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        opacity: isVisible ? 1 : 0
      }}
    >
      <div className="toast-icon">
        {getIcon()}
      </div>
      <div className="toast-content">
        <div className="toast-title">{message.title}</div>
        {message.message && (
          <div className="toast-message">{message.message}</div>
        )}
      </div>
      <button 
        className="toast-close"
        onClick={() => onClose(message.id)}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
};

export default Toast;