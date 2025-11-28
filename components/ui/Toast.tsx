import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { ToastMessage } from '../../types';
import { toastService } from '../../services/toastService';

export const Toast: React.FC = () => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    useEffect(() => {
        const unsubscribe = toastService.subscribe((toast) => {
            setToasts(prev => [...prev, toast]);

            // Auto-dismiss if duration is set
            if (toast.duration) {
                setTimeout(() => {
                    removeToast(toast.id);
                }, toast.duration);
            }
        });

        return unsubscribe;
    }, []);

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const getIcon = (type: ToastMessage['type']) => {
        switch (type) {
            case 'error':
                return <AlertCircle size={20} />;
            case 'warning':
                return <AlertTriangle size={20} />;
            case 'success':
                return <CheckCircle size={20} />;
            case 'info':
                return <Info size={20} />;
        }
    };

    const getColorClasses = (type: ToastMessage['type']) => {
        switch (type) {
            case 'error':
                return 'bg-red-50 border-red-200 text-red-800';
            case 'warning':
                return 'bg-yellow-50 border-yellow-200 text-yellow-800';
            case 'success':
                return 'bg-green-50 border-green-200 text-green-800';
            case 'info':
                return 'bg-blue-50 border-blue-200 text-blue-800';
        }
    };

    if (toasts.length === 0) return null;

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`toast-item ${getColorClasses(toast.type)}`}
                >
                    <div className="toast-icon">
                        {getIcon(toast.type)}
                    </div>
                    <div className="toast-message">
                        {toast.message}
                    </div>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="toast-close"
                        aria-label="Close notification"
                    >
                        <X size={18} />
                    </button>
                </div>
            ))}

            <style>{`
        .toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 420px;
          pointer-events: none;
        }

        .toast-item {
          pointer-events: auto;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 8px;
          border: 1px solid;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          animation: slideIn 0.3s ease-out;
          min-width: 300px;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .toast-icon {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          margin-top: 1px;
        }

        .toast-message {
          flex: 1;
          font-size: 14px;
          line-height: 1.5;
          word-break: break-word;
        }

        .toast-close {
          flex-shrink: 0;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 2px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .toast-close:hover {
          opacity: 1;
        }

        @media (max-width: 640px) {
          .toast-container {
            top: 10px;
            right: 10px;
            left: 10px;
            max-width: none;
          }

          .toast-item {
            min-width: 0;
          }
        }
      `}</style>
        </div>
    );
};
