"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const success = useCallback((message: string) => toast(message, 'success'), [toast]);
  const error = useCallback((message: string) => toast(message, 'error'), [toast]);
  const info = useCallback((message: string) => toast(message, 'info'), [toast]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center w-80 p-4 rounded-md border shadow-lg transition-all duration-300 transform translate-y-0 opacity-100",
              t.type === 'success' ? 'bg-success/10 border-success/30 text-success' :
              t.type === 'error' ? 'bg-danger/10 border-danger/30 text-danger' :
              'bg-accent/10 border-accent/30 text-accent'
            )}
          >
            <div className="flex-shrink-0 mr-3">
              {t.type === 'success' && <CheckCircle2 className="h-5 w-5" />}
              {t.type === 'error' && <XCircle className="h-5 w-5" />}
              {t.type === 'info' && <Info className="h-5 w-5" />}
            </div>
            <div className="flex-1 text-sm font-medium">
              {t.message}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="flex-shrink-0 ml-3 opacity-70 hover:opacity-100 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
