"use client";
/**
 * /inventory — stock ledger console.
 * - Balances: GET /admin/inventory/balances (stockOnHand, reserved, available, threshold)
 * - Low stock: GET /admin/inventory/low-stock (rows highlighted in the balances table too)
 * - Movement form: POST /admin/inventory/movements — reason is mandatory (3+ chars)
 * - History: GET /admin/inventory/movements?variantId=… filtered per variant
 */
import { useState } from "react";
import { ApiError, apiGet, apiPost, can } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApiQuery, usePageTitle } from "@/lib/hooks";
import { formatDateTime, formatNumber, humanize } from "@/lib/format";
import { useToast } from "@/lib/toast";
import type { InventoryBalance, InventoryMovementDoc, LowStockRow } from "@/lib/types";
import { INVENTORY_MOVEMENT_TYPES } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

export default function InventoryPage() {
  usePageTitle("Inventory");
  const { principal } = useAuth();
  const toast = useToast();
  const canWrite = can(principal, "inventory:write");

  const { data: balances, loading, error, reload } = useApiQuery<InventoryBalance[]>(() => apiGet("/admin/inventory/balances"));
  const { data: lowStock, reload: reloadLow } = useApiQuery<LowStockRow[]>(() => apiGet("/admin/inventory/low-stock"));
  const [historyVariant, setHistoryVariant] = useState("");
  const { data: movements, loading: movementsLoading, error: movementsError, reload: reloadMovements } = useApiQuery<
    InventoryMovementDoc[]
  >(() => apiGet("/admin/inventory/movements", { variantId: historyVariant || undefined }), [historyVariant]);

  // movement form
  const [variantId, setVariantId] = useState("");
  const [type, setType] = useState<string>("received");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const lowStockByVariant = new Set((lowStock ?? []).map((row) => row.variant.id));

  async function submitMovement(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsedQty = Number(qty);
    if (!variantId) {
      setFormError("Pick a variant.");
      return;
    }
    if (!Number.isInteger(parsedQty) || parsedQty === 0 || Math.abs(parsedQty) > 1_000_000) {
      setFormError("Quantity must be a non-zero whole number.");
      return;
    }
    if (reason.trim().length < 3) {
      setFormError("A reason of at least 3 characters is required for every stock movement.");
      return;
    }
    setSubmitting(true);
    try {
      const movement = await apiPost<InventoryMovementDoc>("/admin/inventory/movements", {
        variantId,
        type,
        qty: parsedQty,
        reason: reason.trim(),
      });
      toast.success(
        "Movement recorded",
        `${movement.variantSku}: ${movement.qtyDelta > 0 ? "+" : ""}${movement.qtyDelta} stock → ${movement.resultingStockOnHand}`,
      );
      setQty("");
      setReason("");
      reload();
      reloadLow();
      reloadMovements();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Every stock change goes through the ledger with a mandatory reason — balances are maintained transactionally by the API."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Balances"
            subtitle="stockOnHand − reservedQty = available"
            actions={
              <Button variant="outline" size="sm" onClick={() => { reload(); reloadLow(); }}>
                Refresh
              </Button>
            }
          />
          {loading ? (
            <TableSkeleton rows={8} cols={6} />
          ) : error ? (
            <ErrorState message={error.message} status={error.status} onRetry={reload} />
          ) : !balances || balances.length === 0 ? (
            <EmptyState title="No variants" description="Create products with variants to see balances here." />
          ) : (
            <div className="scroll-slim max-h-[32rem] overflow-y-auto">
              <Table>
                <THead>
                  <TR>
                    <TH scope="col">SKU</TH>
                    <TH scope="col">Pack</TH>
                    <TH scope="col">Stock</TH>
                    <TH scope="col">Reserved</TH>
                    <TH scope="col">Available</TH>
                    <TH scope="col">Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {balances.map((b) => {
                    const low = b.available <= b.lowStockThreshold || lowStockByVariant.has(b.variantId);
                    return (
                      <TR key={b.variantId} className={low ? "bg-amber-50/60" : undefined}>
                        <TD className="font-mono text-xs">
                          {b.sku}
                          {low ? <span className="ml-2 rounded bg-amber-200 px-1 py-0.5 text-[10px] font-semibold text-amber-900">LOW</span> : null}
                        </TD>
                        <TD className="text-ink/70">{b.packLabel}</TD>
                        <TD>{formatNumber(b.stockOnHand)}</TD>
                        <TD>{formatNumber(b.reservedQty)}</TD>
                        <TD className={low ? "font-semibold text-amber-800" : "font-semibold"}>{formatNumber(b.available)}</TD>
                        <TD>
                          <StatusBadge status={b.status} />
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          {canWrite ? (
            <Card>
              <CardHeader title="Record movement" subtitle="received / sold / damaged / returned / reserved / released / manual" />
              <CardBody>
                <form className="space-y-3" onSubmit={submitMovement} noValidate>
                  <Field label="Variant" required htmlFor="inv-variant">
                    <Select id="inv-variant" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                      <option value="">Select variant…</option>
                      {(balances ?? [])
                        .filter((b) => b.status !== "archived")
                        .map((b) => (
                          <option key={b.variantId} value={b.variantId}>
                            {b.sku} — {b.packLabel} ({b.available} available)
                          </option>
                        ))}
                    </Select>
                  </Field>
                  <Field label="Type" required htmlFor="inv-type">
                    <Select id="inv-type" value={type} onChange={(e) => setType(e.target.value)}>
                      {INVENTORY_MOVEMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {humanize(t)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Quantity"
                    required
                    htmlFor="inv-qty"
                    hint={type === "manual_adjustment" || type === "other" ? "Signed: +5 adds, −3 removes" : "Absolute; the type sets the direction"}
                  >
                    <Input
                      id="inv-qty"
                      type="number"
                      step="1"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      placeholder={type === "manual_adjustment" ? "-2" : "10"}
                      required
                    />
                  </Field>
                  <Field label="Reason" required hint="Mandatory for every movement — audit trail">
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} placeholder="Damage in transit, batch #42" required />
                  </Field>
                  {formError ? (
                    <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">
                      {formError}
                    </p>
                  ) : null}
                  <Button type="submit" className="w-full" loading={submitting}>
                    Record movement
                  </Button>
                </form>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Low stock" subtitle="Available at or below each variant's threshold" />
            {!lowStock ? (
              <CardBody>
                <p className="text-sm text-ink/50">Loading…</p>
              </CardBody>
            ) : lowStock.length === 0 ? (
              <EmptyState title="Nothing low" description="Every published variant is above its threshold." />
            ) : (
              <ul className="scroll-slim max-h-72 divide-y divide-sand/70 overflow-y-auto">
                {lowStock.map((row) => (
                  <li key={row.variant.id} className="flex items-center justify-between gap-2 px-4 py-2 sm:px-6">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs">{row.variant.sku}</p>
                      <p className="text-xs text-ink/50">{row.variant.packLabel}</p>
                    </div>
                    <span className={`text-sm font-semibold ${row.available === 0 ? "text-red-700" : "text-amber-700"}`}>
                      {formatNumber(row.available)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Movement history"
          subtitle="Newest first, latest 100"
          actions={
            <Select value={historyVariant} onChange={(e) => setHistoryVariant(e.target.value)} className="h-9 w-64 text-xs">
              <option value="">All variants</option>
              {(balances ?? []).map((b) => (
                <option key={b.variantId} value={b.variantId}>
                  {b.sku} — {b.packLabel}
                </option>
              ))}
            </Select>
          }
        />
        {movementsLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : movementsError ? (
          <ErrorState message={movementsError.message} status={movementsError.status} onRetry={reloadMovements} />
        ) : !movements || movements.length === 0 ? (
          <EmptyState title="No movements" description="Stock movements will appear here as they happen." />
        ) : (
          <div className="scroll-slim max-h-96 overflow-y-auto">
            <Table>
              <THead>
                <TR>
                  <TH scope="col">When</TH>
                  <TH scope="col">SKU</TH>
                  <TH scope="col">Type</TH>
                  <TH scope="col">Stock Δ</TH>
                  <TH scope="col">Reserved Δ</TH>
                  <TH scope="col">Resulting</TH>
                  <TH scope="col">Reason</TH>
                  <TH scope="col">By</TH>
                </TR>
              </THead>
              <TBody>
                {movements.map((m) => (
                  <TR key={m.id}>
                    <TD className="text-ink/70">{formatDateTime(m.createdAt)}</TD>
                    <TD className="font-mono text-xs">{m.variantSku}</TD>
                    <TD>{humanize(m.type)}</TD>
                    <TD className={m.qtyDelta > 0 ? "text-forest" : m.qtyDelta < 0 ? "text-red-700" : undefined}>
                      {m.qtyDelta > 0 ? "+" : ""}
                      {m.qtyDelta}
                    </TD>
                    <TD>{m.reservedDelta !== 0 ? `${m.reservedDelta > 0 ? "+" : ""}${m.reservedDelta}` : "—"}</TD>
                    <TD>
                      {m.resultingStockOnHand} / {m.resultingReservedQty}
                    </TD>
                    <TD className="max-w-[16rem] truncate" title={m.reason}>
                      {m.reason}
                    </TD>
                    <TD className="text-ink/60">{m.performedByName ?? m.performedByUid ?? "system"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
