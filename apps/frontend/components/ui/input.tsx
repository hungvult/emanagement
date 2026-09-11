import React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-text-secondary mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "flex h-11 w-full rounded-lg border border-white/10 bg-bg-secondary/50 px-4 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 backdrop-blur-sm transition-all duration-300 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-danger focus:ring-danger/50 focus:border-danger",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
