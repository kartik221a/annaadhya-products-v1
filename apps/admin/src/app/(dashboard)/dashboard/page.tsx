"use client";
/**
 * /dashboard — Overview. GET /admin/dashboard/metrics?days=30
 * KPI cards, honest "Profit: unavailable" note, low stock, recent orders, SVG sales trend.
 */
import { useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { useApiQuery, usePageTitle } from "@/lib/hooks";
import { formatDate, formatDateTime, formatINRRounded, formatNumber } from "@/lib/format";
import type { DashboardMetrics } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { CardsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { SalesTrendChart } from "@/components/sales-trend-chart";

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold tracking-wide text-ink/55 uppercase">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-semibold text-ink">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-ink/50">{sub}</p> : null}
    </Card>
  );
}

export default function DashboardPage() {
  usePageTitle("Overview");
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useApiQuery<DashboardMetrics>(() => apiGet("/admin/dashboard/metrics", { days }), [days]);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Trading snapshot for the selected range. Demo records are excluded from live reporting unless reporting settings say otherwise."
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-ink/60">
              <span className="sr-only sm:not-sr-only">Range</span>
              <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="h-10 w-36">
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last 365 days</option>
              </Select>
            </label>
            <Button variant="outline" size="md" onClick={reload} className="h-10">
              Refresh
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="space-y-6">
          <CardsSkeleton count={6} />
          <Card>
            <Skeleton className="m-6 h-48" />
          </Card>
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={error.message} status={error.status} onRetry={reload} />
        </Card>
      ) : data ? (
        <div className="space-y-6">
          <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Orders" value={formatNumber(data.orders.count)} sub={`${formatNumber(data.orders.paidCount)} paid`} />
            <KpiCard label="Gross sales" value={formatINRRounded(data.grossSalesPaise)} sub="paid orders, before refunds" />
            <KpiCard
              label="Net sales"
              value={formatINRRounded(data.netSalesPaise)}
              sub={`− discounts ${formatINRRounded(data.discountsPaise)} · − refunds ${formatINRRounded(data.refundsPaise)}`}
            />
            <KpiCard label="Payments collected" value={formatINRRounded(data.paymentsCollectedPaise)} sub="succeeded attempts (cash basis)" />
            <KpiCard
              label="Average order value"
              value={data.averageOrderValuePaise === null ? "—" : formatINRRounded(data.averageOrderValuePaise)}
              sub="net sales / paid orders"
            />
            <KpiCard label="Refunds" value={formatINRRounded(data.refundsPaise)} sub="refund amounts in range" />
          </section>

          <Card className="border-honey/40">
            <CardBody className="p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-honey-dark uppercase">Profit</p>
                  <p className="mt-1 font-display text-xl font-semibold text-ink">Unavailable</p>
                </div>
                <p className="max-w-2xl text-sm text-ink/60">{data.profitNote}</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Sales trend"
              subtitle={`${data.range.label} · ${data.demoDataIncluded ? "includes demo records (reporting setting)" : "live data only"}`}
            />
            <SalesTrendChart points={data.salesTrend} />
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="flex flex-col">
              <CardHeader
                title="Low stock"
                subtitle="Published variants at or below their threshold"
                actions={
                  <Link href="/inventory" className="text-sm font-medium text-forest hover:underline">
                    Open inventory →
                  </Link>
                }
              />
              {data.lowStock.length === 0 ? (
                <EmptyState title="Nothing low" description="No published variants are at or below their low-stock threshold." />
              ) : (
                <ul className="scroll-slim max-h-96 divide-y divide-sand/70 overflow-y-auto">
                  {data.lowStock.map((row) => (
                    <li key={row.sku} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
                      <span className="truncate font-mono text-xs text-ink/80">{row.sku}</span>
                      <span className={`text-sm font-semibold ${row.available === 0 ? "text-red-700" : "text-amber-700"}`}>
                        {formatNumber(row.available)} left
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="flex flex-col">
              <CardHeader
                title="Recent orders"
                subtitle="Newest first"
                actions={
                  <Link href="/orders" className="text-sm font-medium text-forest hover:underline">
                    All orders →
                  </Link>
                }
              />
              {data.recentOrders.length === 0 ? (
                <EmptyState title="No orders yet" description="Orders will appear here as the storefront takes them." />
              ) : (
                <ul className="scroll-slim max-h-96 divide-y divide-sand/70 overflow-y-auto">
                  {data.recentOrders.map((o) => (
                    <li key={o.orderNumber} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{o.orderNumber}</p>
                        <p className="text-xs text-ink/50">{formatDateTime(o.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={o.status} />
                        <span className="text-sm font-semibold text-ink">{formatINRRounded(o.totalPaise)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader title="Bestsellers" subtitle="By units sold across paid orders in range" />
            {data.bestsellers.length === 0 ? (
              <EmptyState title="No sales yet" description="Bestsellers appear once paid orders land in the range." />
            ) : (
              <ol className="divide-y divide-sand/70">
                {data.bestsellers.map((b, i) => (
                  <li key={b.sku} className="flex items-center gap-4 px-4 py-3 sm:px-6">
                    <span className="font-display text-lg font-semibold text-honey-dark">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{b.name}</p>
                      <p className="font-mono text-xs text-ink/50">{b.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink">{formatNumber(b.qty)} units</p>
                      <p className="text-xs text-ink/50">{formatINRRounded(b.revenuePaise)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <p className="text-xs text-ink/45">
            Range: {formatDate(data.range.from)} → {formatDate(data.range.to)}. Figures come straight from the reporting
            service; profit is intentionally never guessed.
          </p>
        </div>
      ) : null}
    </div>
  );
}
