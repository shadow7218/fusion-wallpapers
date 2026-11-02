"use client";

import * as React from "react";
import { Button as BaseButton } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-white text-black hover:bg-zinc-200 shadow-sm",
        destructive:
          "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
        outline:
          "border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-white backdrop-blur-xl",
        secondary:
          "bg-zinc-900 border border-white/[0.06] text-zinc-100 hover:bg-zinc-800",
        ghost:
          "hover:bg-white/[0.06] text-zinc-300 hover:text-white",
        link:
          "text-white underline-offset-4 hover:underline",
        glass:
          "bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.12] backdrop-blur-xl shadow-lg",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-[11px]",
        lg: "h-12 rounded-2xl px-6 text-sm",
        icon: "h-9 w-9 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<typeof BaseButton>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        className: cn(buttonVariants({ variant, size }), child.props.className, className),
        ...props,
      });
    }

    return (
      <BaseButton
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </BaseButton>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
