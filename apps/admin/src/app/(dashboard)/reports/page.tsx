"use client";
/**
 * /reports — Excel exports. The list of types is GET /admin/reports/types (reports:read);
 * downloading requires reports:export. Downloads fetch with the Authorization header and
 * hand the bytes to the browser via an object URL (a plain window.open link cannot attach
 * the bearer token, so the token-in-query trick is deliberately NOT used).
 * Exports exclude demo data by default (includeDemo=false) — sheets say so in their subtitle.
 */
import { useState } from "react";
import { ApiError, apiGet, can, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApiQuery, usePageTitle } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import type { ExportType } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

const EXPORT_DESCRIPTIONS: Record<ExportType, { title: string; contains: string }> = {
  products: {
    title: "Products",
    contains: "Full catalogue: SKU, name, subtitle, category, status, merchandising ranks, gift flag, SEO fields.",
  },
  variants: {
    title: "Variants",
    contains: "Pack-level rows: SKU, pack label, grams, price, MRP, stock on hand, reserved, threshold.",
  },
  orders: {
    title: "Orders",
    contains: "Every order with number, contact, address snapshot, totals, payment + fulfilment status, refunds.",
  },
  customers: {
    title: "Customers",
    contains: "Customer directory. PII stays masked for roles without customers:write, exactly like the API responses.",
  },
  inventory_balances: {
    title: "Inventory balances",
    contains: "stockOnHand / reservedQty / available per variant with low-stock threshold and status.",
  },
  inventory_movements: {
    title: "Inventory movements",
    contains: "Full ledger: movement type, signed deltas, resulting balances, mandatory reason, performed by.",
  },
  suppliers: {
    title: "Suppliers",
    contains: "Supplier directory with contact details, location and matched product SKUs.",
  },
  purchases: {
    title: "Purchases",
    contains: "Purchase orders with per-line ordered/received quantities and unit costs (landed-cost inputs).",
  },
  expenses: {
    title: "Expenses",
    contains: "Expense log with date, category, amount, payee and reference.",
  },
  sales_summary: {
    title: "Sales summary",
    contains: "Range totals: gross sales, discounts, refunds, net sales, payments collected, AOV, order counts.",
  },
  newsletter_subscribers: {
    title: "Newsletter subscribers",
    contains:
      "Marketing email list captured on the storefront: address, status, capture source and dates. Personal data — import only into tools that honour unsubscribe.",
  },
};

export default function ReportsPage() {
  usePageTitle("Reports");
  const { principal } = useAuth();
  const toast = useToast();
  const canExport = can(principal, "reports:export");

  const { data, loading, error, reload } = useApiQuery<ExportType[]>(() => apiGet("/admin/reports/types"));
  const [downloading, setDownloading] = useState<string | null>(null);

  async function runExport(type: ExportType) {
    setDownloading(type);
    try {
      // includeDemo is omitted → the API defaults to the reporting setting (false = live only).
      await downloadFile(`/admin/reports/exports/${type}`, { includeDemo: "false" });
      toast.success("Export ready", `${type}.xlsx downloaded (live data only)`);
    } catch (err) {
      toast.error("Export failed", err instanceof ApiError ? err.message : "Unexpected error");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Server-generated Excel workbooks. Each file is labelled and stamped on the day of export."
      />

      <Card className="mb-6 border-honey/40">
        <CardBody className="p-4 text-sm text-ink/70 sm:p-6">
          <p>
            <strong className="text-ink">Demo data is excluded by default.</strong> Every download below requests{" "}
            <code className="rounded bg-cream px-1 py-0.5 text-xs">includeDemo=false</code>, so live reporting stays clean —
            demo/demo-seeded records never mix into financial exports. Authentication rides in the{" "}
            <code className="rounded bg-cream px-1 py-0.5 text-xs">Authorization</code> header; no token ever appears in a URL.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Available exports" subtitle="Requires reports:export to download; the list itself needs reports:read" />
        {loading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : error ? (
          <ErrorState message={error.message} status={error.status} onRetry={reload} />
        ) : !data || data.length === 0 ? (
          <EmptyState title="No export types" description="The API did not return any export types." />
        ) : (
          <ul className="divide-y divide-sand/70">
            {data.map((type) => {
              const meta = EXPORT_DESCRIPTIONS[type] ?? { title: type, contains: "Export" };
              return (
                <li key={type} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-semibold text-ink">{meta.title}</p>
                    <p className="mt-0.5 text-sm text-ink/60">{meta.contains}</p>
                    <p className="mt-0.5 font-mono text-xs text-ink/40">GET /admin/reports/exports/{type}</p>
                  </div>
                  {canExport ? (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={downloading === type}
                      disabled={downloading !== null && downloading !== type}
                      onClick={() => void runExport(type)}
                    >
                      Download .xlsx
                    </Button>
                  ) : (
                    <span className="text-xs text-ink/45">Needs reports:export</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
