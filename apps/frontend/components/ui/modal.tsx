import React from "react";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className={cn(
        "relative w-full max-w-lg transform overflow-hidden rounded-lg bg-bg-secondary border border-border text-left shadow-xl transition-all sm:my-8",
        className
      )}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
          <h3 className="text-lg font-medium text-text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <span className="sr-only">Close</span>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 py-5 sm:p-6 text-text-primary">
          {children}
        </div>
      </div>
    </div>
  );
};
