"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cx(
        "min-h-12 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-medium text-dark outline-none transition placeholder:text-muted focus:border-coral focus:ring-2 focus:ring-coral/25",
        className,
      )}
      {...props}
    />
  );
});
