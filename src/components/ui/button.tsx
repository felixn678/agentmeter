import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

// shadcn-style Button — a native <button> styled via cva variants, no Radix dependency.
// The `segment` variant powers the day/week/month control; active state is driven by aria-selected.
const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "h-9 rounded-lg bg-accent px-4 text-sm text-white hover:opacity-90",
        segment:
          "rounded-[7px] px-3 py-1.5 text-[13px] font-semibold text-muted hover:text-fg aria-selected:bg-surface aria-selected:text-fg aria-selected:shadow-[var(--shadow)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}
