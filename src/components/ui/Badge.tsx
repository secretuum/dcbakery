import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant = "coral" | "burgundy" | "dark" | "neutral" | "green" | "blue" | "amber" | "red";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  coral: "bg-accent-50 text-accent-700",
  burgundy: "bg-accent-50 text-burgundy",
  dark: "bg-espresso text-white",
  neutral: "bg-white text-muted ring-1 ring-black/10",
  green: "bg-success-bg text-success",
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-warning-bg text-warning",
  red: "bg-danger-bg text-danger",
};

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function Badge({ children, className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
