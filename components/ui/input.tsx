"use client";

import * as React from "react";
import { Input as BaseInput } from "@base-ui/react/input";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.ComponentPropsWithoutRef<typeof BaseInput> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <BaseInput
        type={type}
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-xl bg-zinc-900/80 border border-white/[0.08] px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 backdrop-blur-xl transition-all file:border-0 file:bg-transparent file:text-xs file:font-medium focus-visible:outline-none focus-visible:border-white/30 focus-visible:ring-1 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
