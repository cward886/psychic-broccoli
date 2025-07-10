import React, { useState, useCallback } from 'react';
import Toast, { ToastMessage } from './Toast';

interface ToastContainerProps {
  children: React.ReactNode;
}

export const ToastContext = React.createContext<{
  showToast: (message: Omit<ToastMessage, 'id'>) => void;
}>({
  showToast: () => {}
});

export const ToastContainer: React.FC<ToastContainerProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString();
    const newToast: ToastMessage = {
      id,
      ...message
    };
    
    setToasts(prev => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <Toast 
            key={toast.id} 
            message={toast} 
            onClose={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastContainer');
  }
  return context;
};