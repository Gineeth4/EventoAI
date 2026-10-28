import type { ReactNode } from "react";

type StudioSectionHeadingProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export default function StudioSectionHeading({
  title,
  eyebrow,
  description,
  action,
  className = "",
}: StudioSectionHeadingProps) {
  const classes = [
    "studio-section-heading",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <div className="studio-section-heading__text">
        {eyebrow && (
          <span className="studio-section-heading__eyebrow">
            {eyebrow}
          </span>
        )}

        <h2 className="studio-section-heading__title">
          {title}
        </h2>

        {description && (
          <p className="studio-section-heading__description">
            {description}
          </p>
        )}
      </div>

      {action && (
        <div className="studio-section-heading__action">
          {action}
        </div>
      )}
    </div>
  );
}