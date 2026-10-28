import type { ReactNode } from "react";

type StudioChoiceCardProps = {
  title: string;
  children?: ReactNode;
  eyebrow?: string;
  description?: string;
  leadingIcon?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
};

export default function StudioChoiceCard({
  title,
  children,
  eyebrow,
  description,
  leadingIcon,
  selected = false,
  disabled = false,
  onClick,
  className = "",
}: StudioChoiceCardProps) {
  const classes = [
    "studio-choice-card",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      data-selected={selected ? "true" : "false"}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {eyebrow && (
        <span className="studio-choice-card__eyebrow">
          {eyebrow}
        </span>
      )}

      <span className="studio-choice-card__icon">
        {leadingIcon}
        <span className="studio-choice-card__title">
          {title}
        </span>
      </span>

      {description && (
        <span className="studio-choice-card__description">
          {description}
        </span>
      )}

      {children}
    </button>
  );
}