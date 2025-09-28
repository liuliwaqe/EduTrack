"use client";

import { cn } from "@/utils/cn";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  color?: "primary" | "white" | "gray";
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
};

const colorClasses = {
  primary: "border-primary-600",
  white: "border-white",
  gray: "border-gray-600",
};

export function LoadingSpinner({ 
  size = "md", 
  className,
  color = "primary" 
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "loading-spinner",
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      aria-label="加载中..."
    />
  );
}
