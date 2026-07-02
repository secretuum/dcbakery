import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "outline" | "ghost";

type ButtonBaseProps = {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
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
  primary: "bg-coral text-white hover:bg-coral-hover",
  outline: "border border-coral bg-transparent text-coral hover:bg-coral-light",
  ghost: "bg-transparent text-dark hover:bg-coral-light",
};

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function Button(props: ButtonProps) {
  const { children, className, variant = "primary", ...rest } = props;
  const classes = cx(
    "inline-flex min-h-11 items-center justify-center rounded-btn px-5 py-3 text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
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
