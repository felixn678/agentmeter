import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

// shadcn-style Card — a plain styled <div>, no Radix dependency.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-border bg-surface shadow-[var(--shadow)]",
        className,
      )}
      {...props}
    />
  );
}
