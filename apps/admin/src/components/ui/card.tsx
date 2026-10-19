import type { HTMLAttributes, ReactNode } from "react";

/** Card primitives — consistent p-4/p-6 padding and soft sand borders. */
export function Card({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-lg border border-sand bg-white shadow-xs ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 border-b border-sand px-4 py-3 sm:px-6 ${className}`}>
      <div className="min-w-0">
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-ink/60">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`p-4 sm:p-6 ${className}`}>{children}</div>;
}
