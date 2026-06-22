import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant = "coral" | "burgundy" | "dark" | "neutral";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  coral: "bg-coral-light text-coral",
  burgundy: "bg-[#f7d9e5] text-burgundy",
  dark: "bg-dark text-white",
  neutral: "bg-white text-muted ring-1 ring-black/10",
};

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function Badge({ children, className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cx(
        "inline-flex items-center rounded-badge px-3 py-1 text-xs font-bold",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
