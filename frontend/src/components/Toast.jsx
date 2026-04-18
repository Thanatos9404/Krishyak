import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

const Toast = ({ message, type = 'success', profitImprovement, onClose, onAction, actionText }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for exit animation
    }, 6000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const styles = {
    success: {
      bg: 'bg-gradient-to-r from-green-500 to-green-600',
      icon: <CheckCircle className="w-6 h-6 text-white" />,
      border: 'border-green-400'
    },
    error: {
      bg: 'bg-gradient-to-r from-red-500 to-red-600',
      icon: <AlertCircle className="w-6 h-6 text-white" />,
      border: 'border-red-400'
    }
  };

  const style = styles[type];

  return (
    <div
      className={`fixed top-4 left-3 right-3 sm:left-auto sm:right-6 z-50 sm:max-w-md transition-all duration-300 ${isVisible ? 'animate-fade-in sm:animate-slide-in-right' : 'opacity-0 -translate-y-full sm:translate-y-0 sm:translate-x-full'
        }`}
    >
      <div className={`${style.bg} rounded-2xl shadow-2xl overflow-hidden`}>
        {/* Main content */}
        <div className="p-4 flex items-start">
          <div className="flex-shrink-0 mr-3">
            {style.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold">{message}</p>

            {profitImprovement && (
              <p className="text-white/90 text-sm mt-1">
                Your optimized strategy can increase profit by{' '}
                <span className="font-bold">₹{(profitImprovement / 1000).toFixed(1)}k</span>
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 ml-2 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Action button */}
        {onAction && actionText && (
          <div className="px-4 pb-4">
            <button
              onClick={() => {
                onAction();
                handleClose();
              }}
              className="w-full bg-white/20 hover:bg-white/30 text-white py-2 px-4 rounded-xl flex items-center justify-center transition-all duration-200"
            >
              <span className="font-semibold">{actionText}</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Toast container to manage multiple toasts
export const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 left-3 right-3 sm:left-auto sm:right-6 z-50 space-y-3 sm:max-w-md">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

// Hook to manage toasts
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = (toast) => {
    const id = Date.now();
    setToasts(prev => [...prev, { ...toast, id }]);
    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return { toasts, addToast, removeToast };
};

export default Toast;
