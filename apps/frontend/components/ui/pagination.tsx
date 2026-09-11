import React from "react";
import { cn } from "../../lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  pageNumber: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({ pageNumber, totalPages, onPageChange, className }) => {
  if (totalPages <= 1) return null;

  return (
    <div className={cn("flex items-center justify-center space-x-2 mt-4", className)}>
      <button
        onClick={() => onPageChange(pageNumber - 1)}
        disabled={pageNumber === 0}
        className="p-2 rounded-md border border-border bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      
      <span className="text-sm text-text-secondary">
        Trang <span className="font-medium text-text-primary">{pageNumber + 1}</span> / {totalPages}
      </span>
      
      <button
        onClick={() => onPageChange(pageNumber + 1)}
        disabled={pageNumber >= totalPages - 1}
        className="p-2 rounded-md border border-border bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};
