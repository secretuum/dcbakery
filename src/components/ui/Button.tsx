import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant =
  | "primary"
  | "outline"
  | "secondary"
  | "dark"
  | "soft"
  | "ghost"
  | "danger"
  | "white";
type ButtonSize = "xs" | "sm" | "md" | "lg";

type ButtonBaseProps = {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
};

type ButtonAnchorProps = ButtonBaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

type ButtonNativeProps = ButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

export type ButtonProps = ButtonAnchorProps | ButtonNativeProps;

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-coral text-white hover:bg-coral-hover active:bg-accent-press",
  outline: "border border-coral bg-white text-coral hover:bg-coral-light",
  secondary: "border border-black/10 bg-white text-dark hover:border-coral hover:text-coral",
  dark: "bg-espresso text-white hover:bg-espresso/90",
  soft: "bg-accent-50 text-accent-700 hover:bg-accent-100",
  ghost: "bg-transparent text-ink-soft hover:bg-black/5",
  danger: "bg-danger-bg text-danger hover:bg-danger hover:text-white",
  white: "bg-white text-accent-700 shadow-sm hover:text-coral",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "min-h-9 gap-1.5 px-3.5 text-xs",
  sm: "min-h-10 gap-2 px-[18px] text-[13.5px]",
  md: "min-h-12 gap-2 px-6 text-[15px]",
  lg: "min-h-14 gap-2.5 px-[30px] text-[17px]",
};

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function Button(props: ButtonProps) {
  const { children, className, variant = "primary", size = "md", block, ...rest } = props;
  const classes = cx(
    "inline-flex items-center justify-center rounded-btn font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    sizeClasses[size],
    variantClasses[variant],
    block && "w-full",
    className,
  );

  if ("href" in rest && rest.href) {
    const anchorProps = rest as AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

    return (
      <a {...anchorProps} className={classes}>
        {children}
      </a>
    );
  }

  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button {...buttonProps} type={buttonProps.type ?? "button"} className={classes}>
      {children}
    </button>
  );
}
