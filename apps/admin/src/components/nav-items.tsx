import type { ComponentType } from "react";

/** Sidebar navigation definition. `permission` gates visibility (UI only — the API enforces). */
export interface NavItem {
  href: string;
  label: string;
  permission: string;
  /** Visible when the principal has ANY of these (used for combined sections). */
  anyOf?: string[];
  icon: ComponentType<{ className?: string }>;
}

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/* Inline SVG icons — 24px grid, no icon library. */
export const IconOverview = ({ className = "" }: { className?: string }) => (
  <svg className={className} {...svgProps} aria-hidden>
    <path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-5H3zM13 8h8V3h-8z" />
  </svg>
);

export const IconProducts = ({ className = "" }: { className?: string }) => (
  <svg className={className} {...svgProps} aria-hidden>
    <path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5m0 0 9-5m-9 5v10" />
  </svg>
);

export const IconOrders = ({ className = "" }: { className?: string }) => (
  <svg className={className} {...svgProps} aria-hidden>
    <path d="M6 2 4 6v14h16V6l-2-4zM4 6h16M9 10a3 3 0 0 0 6 0" />
  </svg>
);

export const IconInventory = ({ className = "" }: { className?: string }) => (
  <svg className={className} {...svgProps} aria-hidden>
    <path d="M3 9.5 12 4l9 5.5M5 10v9h14v-9M9 19v-5h6v5" />
  </svg>
);

export const IconSuppliers = ({ className = "" }: { className?: string }) => (
  <svg className={className} {...svgProps} aria-hidden>
    <path d="M3 21V8l7-5 7 5m-14 0v13h14V8m-14 0h14M9 21v-6h6v6M8 8h4M13 8h4" />
  </svg>
);

export const IconCustomers = ({ className = "" }: { className?: string }) => (
  <svg className={className} {...svgProps} aria-hidden>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const IconExpenses = ({ className = "" }: { className?: string }) => (
  <svg className={className} {...svgProps} aria-hidden>
    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

export const IconReports = ({ className = "" }: { className?: string }) => (
  <svg className={className} {...svgProps} aria-hidden>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h2m-2 4h6M16 13h.01" />
  </svg>
);

export const IconTeam = ({ className = "" }: { className?: string }) => (
  <svg className={className} {...svgProps} aria-hidden>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const IconSettings = ({ className = "" }: { className?: string }) => (
  <svg className={className} {...svgProps} aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);

export const IconAudit = ({ className = "" }: { className?: string }) => (
  <svg className={className} {...svgProps} aria-hidden>
    <path d="M12 8v4l2.5 2.5M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z" />
  </svg>
);

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", permission: "dashboard:read", icon: IconOverview },
  { href: "/products", label: "Products", permission: "products:read", icon: IconProducts },
  { href: "/orders", label: "Orders", permission: "orders:read", icon: IconOrders },
  { href: "/inventory", label: "Inventory", permission: "inventory:read", icon: IconInventory },
  { href: "/purchases", label: "Suppliers & Purchases", permission: "suppliers:read", anyOf: ["suppliers:read", "purchases:read"], icon: IconSuppliers },
  { href: "/customers", label: "Customers", permission: "customers:read", icon: IconCustomers },
  { href: "/expenses", label: "Expenses", permission: "expenses:read", icon: IconExpenses },
  { href: "/reports", label: "Reports", permission: "reports:read", icon: IconReports },
  { href: "/team", label: "Team", permission: "team:read", icon: IconTeam },
  { href: "/settings", label: "Settings", permission: "settings:read", icon: IconSettings },
  { href: "/audit", label: "Audit log", permission: "audit:read", icon: IconAudit },
];
