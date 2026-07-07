import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant = "coral" | "burgundy" | "dark" | "neutral" | "green" | "blue" | "amber" | "red";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  coral: "bg-coral-light text-coral",
  burgundy: "bg-coral-light text-burgundy",
  dark: "bg-dark text-white",
  neutral: "bg-white text-muted ring-1 ring-black/10",
  green: "bg-green-50 text-green-700",
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
};

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function Badge({ children, className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
