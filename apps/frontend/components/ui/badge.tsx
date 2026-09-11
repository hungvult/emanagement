import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "danger" | "outline";
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants = {
      default: "bg-bg-tertiary/50 text-text-primary backdrop-blur-md border border-white/10",
      success: "bg-success-bg text-success border border-success/30 backdrop-blur-md",
      warning: "bg-warning-bg text-warning border border-warning/30 backdrop-blur-md",
      danger: "bg-danger-bg text-danger border border-danger/30 backdrop-blur-md",
      outline: "text-text-secondary border border-border/50",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";
