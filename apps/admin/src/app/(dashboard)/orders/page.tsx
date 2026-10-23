"use client";
/**
 * /orders — admin order list with search + status/payment filters and pagination.
 * GET /admin/orders?search=&status=&paymentStatus=&page=&pageSize= (Page<OrderDoc>).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { useApiQuery, usePageTitle } from "@/lib/hooks";
import { formatDateTime, formatINR, humanize } from "@/lib/format";
import type { OrderDoc, OrderStatus, Page, PaymentStatus } from "@/lib/types";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

const PAGE_SIZE = 20;

export default function OrdersPage() {
  usePageTitle("Orders");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "">("");
  const [page, setPage] = useState(1);

  // Deep link support (?status=shipped) — the dashboard attention cards link here
  // with a preselected status. Read once after mount from the real URL; unknown or
  // invalid values are ignored so the page behaves exactly as before.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("status");
    if (param && (ORDER_STATUSES as readonly string[]).includes(param)) {
      setStatus(param as OrderStatus);
      setPage(1);
    }
  }, []);

  const { data, loading, error, reload } = useApiQuery<Page<OrderDoc>>(
    () =>
      apiGet<Page<OrderDoc>>("/admin/orders", {
        search: appliedSearch || undefined,
        status: status || undefined,
        paymentStatus: paymentStatus || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [appliedSearch, status, paymentStatus, page],
  );

  function resetToFirstPage() {
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Search by order number, customer name, email or phone. Unpaid orders can never be pushed into fulfilment — the API enforces the state machine."
      />

      <Card className="mb-6 p-4 sm:p-6">
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedSearch(search.trim());
            resetToFirstPage();
          }}
        >
          <Field label="Search" htmlFor="order-search">
            <Input
              id="order-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="AN-2026-000123, name, email, phone"
            />
          </Field>
          <Field label="Status">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as OrderStatus | "");
                resetToFirstPage();
              }}
            >
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Payment status">
            <Select
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(e.target.value as PaymentStatus | "");
                resetToFirstPage();
              }}
            >
              <option value="">All payments</option>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit">Search</Button>
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setAppliedSearch("");
                setStatus("");
                setPaymentStatus("");
                resetToFirstPage();
              }}
            >
              Clear
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : error ? (
          <ErrorState message={error.message} status={error.status} onRetry={reload} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No orders found" description="Try widening the filters, or clear the search." />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH scope="col">Order</TH>
                  <TH scope="col">Placed</TH>
                  <TH scope="col">Customer</TH>
                  <TH scope="col">Items</TH>
                  <TH scope="col">Total</TH>
                  <TH scope="col">Status</TH>
                  <TH scope="col">Payment</TH>
                </TR>
              </THead>
              <TBody>
                {data.items.map((o) => (
                  <TR key={o.id}>
                    <TD>
                      <Link href={`/orders/${o.id}`} className="font-semibold text-forest hover:underline">
                        {o.orderNumber}
                      </Link>
                      {o.isDemo ? <span className="ml-2 rounded bg-honey/15 px-1 py-0.5 text-[10px] font-semibold text-honey-dark">DEMO</span> : null}
                    </TD>
                    <TD className="text-ink/70">{formatDateTime(o.createdAt)}</TD>
                    <TD className="max-w-[14rem] truncate" title={o.customerContact.email}>
                      {o.customerContact.displayName}
                      <span className="block text-xs text-ink/50">{o.customerContact.email || o.customerContact.phone || "—"}</span>
                    </TD>
                    <TD>{o.items.reduce((sum, item) => sum + item.qty, 0)}</TD>
                    <TD className="font-semibold">{formatINR(o.totalPaise)}</TD>
                    <TD>
                      <StatusBadge status={o.status} />
                    </TD>
                    <TD>
                      <StatusBadge status={o.paymentStatus} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sand px-4 py-3 text-sm sm:px-6">
              <p className="text-ink/60">
                Page {data.page} of {data.totalPages} · {data.total} orders
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  ← Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= (data?.totalPages ?? 1)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next →
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
