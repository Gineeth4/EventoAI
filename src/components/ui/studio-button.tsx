import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger";

type ButtonSize = "sm" | "md" | "lg";

type StudioButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "size"
> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  className?: string;
};

export default function StudioButton({
  variant = "primary",
  size = "md",
  loading = false,
  leadingIcon,
  trailingIcon,
  className = "",
  disabled,
  type = "button",
  children,
  ...buttonProps
}: StudioButtonProps) {
  const classes = [
    "studio-button",
    `studio-button--${variant}`,
    `studio-button--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...buttonProps}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <span
          className="studio-button__spinner"
          aria-hidden="true"
        />
      ) : leadingIcon ? (
        <span
          className="studio-button__icon"
          aria-hidden="true"
        >
          {leadingIcon}
        </span>
      ) : null}

      <span>{children}</span>

      {!loading && trailingIcon && (
        <span
          className="studio-button__icon"
          aria-hidden="true"
        >
          {trailingIcon}
        </span>
      )}
    </button>
  );
}