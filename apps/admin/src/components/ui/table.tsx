import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

/** Table primitives — horizontally scrollable wrapper for small screens. */
export function Table({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="w-full min-w-max border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-sand bg-cream/60 text-xs tracking-wide text-ink/60 uppercase">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-sand/70">{children}</tbody>;
}

export function TR({
  children,
  className = "",
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`transition-colors hover:bg-cream/50 ${className}`} {...rest}>
      {children}
    </tr>
  );
}

export function TH({ className = "", ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`px-4 py-2.5 font-semibold whitespace-nowrap ${className}`} {...rest} />;
}

export function TD({ className = "", ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 align-middle whitespace-nowrap ${className}`} {...rest} />;
}
