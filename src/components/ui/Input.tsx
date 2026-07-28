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
        "min-h-[52px] w-full rounded-md border-[1.5px] border-black/10 bg-white px-4 py-3 text-[15px] font-medium text-dark outline-none transition placeholder:text-muted-light hover:border-black/20 focus:border-coral focus:ring-4 focus:ring-coral/15",
        className,
      )}
      {...props}
    />
  );
});
