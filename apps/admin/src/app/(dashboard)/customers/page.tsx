"use client";
/**
 * /customers — admin customer directory.
 * PII minimisation is server-side: roles without customers:write receive masked
 * email/phone and NO addresses. Suspend/activate requires customers:write.
 * NOTE (API gap): there is no admin endpoint to list orders by customer yet — the detail
 * dialog fetches the most recent 100 orders and filters client-side, which is best-effort.
 */
import { useState } from "react";
import { ApiError, apiGet, apiPost, can } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApiQuery, usePageTitle } from "@/lib/hooks";
import { formatDate, formatDateTime, formatINR, humanize } from "@/lib/format";
import { useToast } from "@/lib/toast";
import type { CustomerDoc, OrderDoc, Page } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Dialog } from "@/components/ui/dialog";

export default function CustomersPage() {
  usePageTitle("Customers");
  const { principal } = useAuth();
  const toast = useToast();
  const canWrite = can(principal, "customers:write");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const { data, loading, error, reload } = useApiQuery<CustomerDoc[]>(
    () => apiGet("/admin/customers", { search: search || undefined }),
    [search],
  );

  const [detail, setDetail] = useState<CustomerDoc | null>(null);
  const [detailOrders, setDetailOrders] = useState<OrderDoc[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function openDetail(customer: CustomerDoc) {
    setDetail(customer);
    setDetailOrders(null);
    try {
      const full = await apiGet<CustomerDoc>(`/admin/customers/${customer.id}`);
      setDetail(full);
      // Best-effort: filter the latest 100 orders client-side (no per-customer admin endpoint yet).
      const orders = await apiGet<Page<OrderDoc>>("/admin/orders", { pageSize: 100, page: 1 });
      setDetailOrders(orders.items.filter((o) => o.customerUid === customer.uid));
    } catch (err) {
      toast.error("Could not load details", err instanceof ApiError ? err.message : "Unexpected error");
    }
  }

  async function setStatus(customer: CustomerDoc, status: "active" | "suspended") {
    setBusyId(customer.id);
    try {
      await apiPost(`/admin/customers/${customer.id}/status`, { status });
      toast.success(status === "suspended" ? "Customer suspended" : "Customer activated", customer.displayName);
      reload();
    } catch (err) {
      toast.error("Could not update customer", err instanceof ApiError ? err.message : "Unexpected error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Contact details are masked server-side unless your role carries customers:write."
      />

      <Card className="mb-6 p-4 sm:p-6">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
          }}
        >
          <Field label="Search" htmlFor="customer-search" className="flex-1">
            <Input
              id="customer-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, email or phone"
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit">Search</Button>
            <Button
              variant="outline"
              onClick={() => {
                setSearchInput("");
                setSearch("");
              }}
            >
              Clear
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : error ? (
          <ErrorState message={error.message} status={error.status} onRetry={reload} />
        ) : !data || data.length === 0 ? (
          <EmptyState title="No customers found" description="Customers appear here after their first sign-in or order." />
        ) : (
          <div className="scroll-slim max-h-[36rem] overflow-y-auto">
            <Table>
              <THead>
                <TR>
                  <TH scope="col">Customer</TH>
                  <TH scope="col">Contact (masked)</TH>
                  <TH scope="col">Providers</TH>
                  <TH scope="col">Status</TH>
                  <TH scope="col">Marketing</TH>
                  <TH scope="col">Joined</TH>
                  <TH scope="col">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {data.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">
                      <button type="button" className="text-left hover:underline" onClick={() => void openDetail(c)}>
                        {c.displayName}
                      </button>
                      {c.isDemo ? <span className="ml-2 rounded bg-honey/15 px-1 py-0.5 text-[10px] font-semibold text-honey-dark">DEMO</span> : null}
                    </TD>
                    <TD className="text-ink/70">
                      {[c.email ?? "—", c.phone ?? ""].filter(Boolean).join(" · ")}
                    </TD>
                    <TD className="text-ink/60">{(c.providers ?? []).join(", ") || "—"}</TD>
                    <TD>
                      <StatusBadge status={c.accountStatus} />
                    </TD>
                    <TD>{c.marketingOptIn ? "Opted in" : "—"}</TD>
                    <TD className="text-ink/60">{formatDate(c.createdAt)}</TD>
                    <TD>
                      <div className="flex items-center gap-1.5">
                        <Button variant="ghost" size="sm" onClick={() => void openDetail(c)}>
                          Details
                        </Button>
                        {canWrite ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={c.accountStatus === "active" ? "text-red-700 hover:bg-red-50" : ""}
                            disabled={busyId === c.id}
                            onClick={() => void setStatus(c, c.accountStatus === "active" ? "suspended" : "active")}
                          >
                            {c.accountStatus === "active" ? "Suspend" : "Activate"}
                          </Button>
                        ) : null}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.displayName ?? "Customer"}
        description={detail ? `UID ${detail.uid}` : undefined}
        wide
      >
        {detail ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-ink/55 uppercase">Email</p>
                <p>{detail.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-ink/55 uppercase">Phone</p>
                <p>{detail.phone ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-ink/55 uppercase">Status</p>
                <StatusBadge status={detail.accountStatus} />
              </div>
              <div>
                <p className="text-xs font-semibold text-ink/55 uppercase">Marketing</p>
                <p>{detail.marketingOptIn ? "Opted in" : "Not opted in"}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-ink/55 uppercase">Addresses</p>
              {!canWrite ? (
                <p className="mt-1 text-ink/60">Addresses are hidden for roles without customers:write (server-side masking).</p>
              ) : detail.addresses.length === 0 ? (
                <p className="mt-1 text-ink/60">No saved addresses.</p>
              ) : (
                <ul className="mt-1 space-y-2">
                  {detail.addresses.map((a) => (
                    <li key={a.id} className="rounded-md border border-sand bg-cream/40 p-2.5">
                      <p className="font-medium">
                        {a.label} {a.isDefault ? <span className="ml-1 text-xs text-honey-dark">default</span> : null}
                      </p>
                      <p className="text-ink/70">
                        {a.fullName}, {a.phone}
                      </p>
                      <p className="text-ink/70">
                        {a.line1}
                        {a.line2 ? `, ${a.line2}` : ""}
                        {a.landmark ? ` (${a.landmark})` : ""}, {a.city}, {a.state} — {a.pincode}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {detail.notes ? (
              <div>
                <p className="text-xs font-semibold text-ink/55 uppercase">Internal notes</p>
                <p className="mt-1 rounded-md bg-cream p-2.5 text-ink/80">{detail.notes}</p>
              </div>
            ) : null}

            <div>
              <p className="text-xs font-semibold text-ink/55 uppercase">Recent orders</p>
              {detailOrders === null ? (
                <p className="mt-1 text-ink/50">Loading orders…</p>
              ) : detailOrders.length === 0 ? (
                <p className="mt-1 text-ink/60">No orders found in the latest 100 (no per-customer admin endpoint yet).</p>
              ) : (
                <ul className="mt-1 divide-y divide-sand/70 rounded-md border border-sand">
                  {detailOrders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div>
                        <p className="font-medium">{o.orderNumber}</p>
                        <p className="text-xs text-ink/50">{formatDateTime(o.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={o.status} />
                        <span className="font-semibold">{formatINR(o.totalPaise)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-xs text-ink/45">
              Account since {formatDate(detail.createdAt)} · providers: {(detail.providers ?? []).map(humanize).join(", ") || "—"}
            </p>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
