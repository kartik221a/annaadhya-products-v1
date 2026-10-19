"use client";
/**
 * /purchases — suppliers & purchases.
 * - Suppliers: GET/POST /admin/suppliers (search)
 * - Purchases: GET/POST /admin/purchases with item rows (variantSku, description,
 *   qtyOrdered, unit cost typed in rupees → paise)
 * - Receive: POST /admin/purchases/:id/receive with receipts [{variantSku, qty}]
 *   pre-filled with outstanding quantities. Receiving is the only path that creates
 *   sellable stock (it posts `received` inventory movements server-side).
 */
import { useState } from "react";
import { ApiError, apiGet, apiPost, can } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApiQuery, usePageTitle } from "@/lib/hooks";
import { formatDate, formatINR, rupeesToPaise } from "@/lib/format";
import { useToast } from "@/lib/toast";
import type { PurchaseDoc, PurchaseStatus, SupplierDoc } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Dialog } from "@/components/ui/dialog";

/* ------------------------------- suppliers -------------------------------- */

function SupplierCreateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [skus, setSkus] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Supplier name must be at least 2 characters.");
      return;
    }
    const productSkus = skus
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    setSaving(true);
    try {
      await apiPost<SupplierDoc>("/admin/suppliers", {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        productSkus,
      });
      toast.success("Supplier added", name.trim());
      setName("");
      setPhone("");
      setEmail("");
      setLocation("");
      setNotes("");
      setSkus("");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add supplier" description="Suppliers feed purchases — the source of landed costs.">
      <form className="space-y-3" onSubmit={submit} noValidate>
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
        <Field label="Location">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={160} />
        </Field>
        <Field label="Product SKUs" hint="Comma or space separated; helps match purchases to catalogue">
          <Input value={skus} onChange={(e) => setSkus(e.target.value.toUpperCase())} placeholder="AN-HNY-001-250G, AN-KES-001-1G" />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} />
        </Field>
        {error ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Add supplier
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ------------------------------- purchases -------------------------------- */

interface ItemRow {
  key: string;
  variantSku: string;
  description: string;
  qtyOrdered: string;
  unitCost: string; // rupees
}

function emptyItemRow(): ItemRow {
  return { key: `pi${Math.random().toString(36).slice(2, 9)}`, variantSku: "", description: "", qtyOrdered: "", unitCost: "" };
}

function PurchaseCreateDialog({
  open,
  onClose,
  suppliers,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: SupplierDoc[];
  onCreated: () => void;
}) {
  const toast = useToast();
  const [supplierId, setSupplierId] = useState("");
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState<PurchaseStatus>("draft");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([emptyItemRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supplierId) return void setError("Pick a supplier.");
    if (reference.trim().length < 2) return void setError("Reference must be at least 2 characters.");

    const payloadItems = [];
    for (const [idx, row] of items.entries()) {
      const label = `Line ${idx + 1}`;
      const variantSku = row.variantSku.trim().toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9\-_.]{2,40}$/.test(variantSku)) {
        setError(`${label}: SKU must be 3-41 chars (A-Z, 0-9, dashes).`);
        return;
      }
      const qtyOrdered = Number(row.qtyOrdered);
      if (!Number.isInteger(qtyOrdered) || qtyOrdered < 1) {
        setError(`${label}: ordered quantity must be a whole number ≥ 1.`);
        return;
      }
      const unitCostPaise = rupeesToPaise(row.unitCost);
      if (Number.isNaN(unitCostPaise) || unitCostPaise < 0) {
        setError(`${label}: unit cost is not a valid amount.`);
        return;
      }
      payloadItems.push({
        variantSku,
        description: row.description.trim(),
        qtyOrdered,
        qtyReceived: 0,
        unitCostPaise,
      });
    }

    setSaving(true);
    try {
      const doc = await apiPost<PurchaseDoc>("/admin/purchases", {
        supplierId,
        reference: reference.trim(),
        status,
        notes: notes.trim() || undefined,
        items: payloadItems,
      });
      toast.success("Purchase created", `${doc.reference} — ${doc.items.length} line(s)`);
      setSupplierId("");
      setReference("");
      setStatus("draft");
      setNotes("");
      setItems([emptyItemRow()]);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New purchase" description="Record an order to a supplier. Stock only enters the ledger when you receive it." wide>
      <form className="space-y-3" onSubmit={submit} noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Supplier" required>
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Select supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" required>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO-2026-0042" />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as PurchaseStatus)}>
              <option value="draft">Draft</option>
              <option value="ordered">Ordered</option>
            </Select>
          </Field>
        </div>

        <div className="space-y-3">
          {items.map((row, idx) => (
            <fieldset key={row.key} className="rounded-md border border-sand bg-cream/40 p-3">
              <legend className="px-1 text-xs font-semibold text-ink/70">Line {idx + 1}</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Variant SKU" required>
                  <Input
                    value={row.variantSku}
                    onChange={(e) => setItems((rows) => rows.map((r) => (r.key === row.key ? { ...r, variantSku: e.target.value.toUpperCase() } : r)))}
                    placeholder="AN-HNY-001-250G"
                  />
                </Field>
                <Field label="Description">
                  <Input
                    value={row.description}
                    onChange={(e) => setItems((rows) => rows.map((r) => (r.key === row.key ? { ...r, description: e.target.value } : r)))}
                    maxLength={200}
                  />
                </Field>
                <Field label="Qty ordered" required>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={row.qtyOrdered}
                    onChange={(e) => setItems((rows) => rows.map((r) => (r.key === row.key ? { ...r, qtyOrdered: e.target.value } : r)))}
                  />
                </Field>
                <Field label="Unit cost ₹" required>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={row.unitCost}
                    onChange={(e) => setItems((rows) => rows.map((r) => (r.key === row.key ? { ...r, unitCost: e.target.value } : r)))}
                    placeholder="312.50"
                  />
                </Field>
              </div>
              <div className="mt-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-700 hover:bg-red-50"
                  onClick={() => setItems((rows) => rows.filter((r) => r.key !== row.key))}
                >
                  Remove line
                </Button>
              </div>
            </fieldset>
          ))}
          <Button variant="outline" size="sm" onClick={() => setItems((rows) => [...rows, emptyItemRow()])}>
            + Add line
          </Button>
        </div>

        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} />
        </Field>

        {error ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Create purchase
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ------------------------------ receive dialog ----------------------------- */

function ReceiveDialog({
  purchase,
  onClose,
  onReceived,
}: {
  purchase: PurchaseDoc | null;
  onClose: () => void;
  onReceived: () => void;
}) {
  const toast = useToast();
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Pre-fill outstanding quantities once per purchase.
  if (purchase && loadedFor !== purchase.id) {
    setLoadedFor(purchase.id);
    const initial: Record<string, string> = {};
    for (const item of purchase.items) {
      initial[item.variantSku] = String(Math.max(0, item.qtyOrdered - item.qtyReceived));
    }
    setQtys(initial);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!purchase) return;
    setError(null);
    const receipts = purchase.items
      .map((item) => ({ variantSku: item.variantSku, qty: Number(qtys[item.variantSku] ?? "0") }))
      .filter((r) => Number.isInteger(r.qty) && r.qty > 0);
    if (receipts.length === 0) {
      setError("Enter a quantity (at least 1) for at least one line.");
      return;
    }
    setSaving(true);
    try {
      await apiPost<PurchaseDoc>(`/admin/purchases/${purchase.id}/receive`, { receipts });
      toast.success("Stock received", `${purchase.reference} — receipts posted to the inventory ledger`);
      onReceived();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={Boolean(purchase)}
      onClose={onClose}
      title={purchase ? `Receive — ${purchase.reference}` : "Receive"}
      description="Quantities received now. Receiving posts `received` movements into the inventory ledger."
    >
      {purchase ? (
        <form className="space-y-3" onSubmit={submit} noValidate>
          {purchase.items.map((item) => {
            const outstanding = item.qtyOrdered - item.qtyReceived;
            return (
              <div key={item.variantSku} className="flex flex-wrap items-end gap-3 rounded-md border border-sand bg-cream/40 p-3">
                <div className="min-w-40 flex-1">
                  <p className="font-mono text-xs font-semibold">{item.variantSku}</p>
                  <p className="text-xs text-ink/55">
                    {item.description || "—"} · ordered {item.qtyOrdered}, received {item.qtyReceived}
                  </p>
                </div>
                <Field label="Receive qty" htmlFor={`rcv-${item.variantSku}`} className="w-28">
                  <Input
                    id={`rcv-${item.variantSku}`}
                    type="number"
                    min="0"
                    step="1"
                    max={outstanding}
                    value={qtys[item.variantSku] ?? "0"}
                    onChange={(e) => setQtys((q) => ({ ...q, [item.variantSku]: e.target.value }))}
                    disabled={outstanding <= 0}
                  />
                </Field>
                <p className="pb-3 text-xs text-ink/50">outstanding {Math.max(0, outstanding)}</p>
              </div>
            );
          })}
          {error ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Confirm receipt
            </Button>
          </div>
        </form>
      ) : null}
    </Dialog>
  );
}

/* --------------------------------- page ----------------------------------- */

export default function PurchasesPage() {
  usePageTitle("Suppliers & Purchases");
  const { principal } = useAuth();

  const canSuppliersRead = can(principal, "suppliers:read");
  const canSuppliersWrite = can(principal, "suppliers:write");
  const canPurchasesRead = can(principal, "purchases:read");
  const canPurchasesWrite = can(principal, "purchases:write");

  const { data: suppliers, loading: suppliersLoading, error: suppliersError, reload: reloadSuppliers } = useApiQuery<SupplierDoc[]>(
    () => apiGet("/admin/suppliers"),
  );
  const { data: purchases, loading: purchasesLoading, error: purchasesError, reload: reloadPurchases } = useApiQuery<PurchaseDoc[]>(
    () => apiGet("/admin/purchases"),
  );

  const [supplierDialog, setSupplierDialog] = useState(false);
  const [purchaseDialog, setPurchaseDialog] = useState(false);
  const [receiving, setReceiving] = useState<PurchaseDoc | null>(null);

  const supplierName = (id: string) => suppliers?.find((s) => s.id === id)?.name ?? id;

  function receivedSummary(p: PurchaseDoc): string {
    const ordered = p.items.reduce((sum, i) => sum + i.qtyOrdered, 0);
    const received = p.items.reduce((sum, i) => sum + i.qtyReceived, 0);
    return `${received}/${ordered} units`;
  }

  return (
    <div>
      <PageHeader
        title="Suppliers & Purchases"
        description="Purchase orders and goods receipts. Receiving a purchase is the only path that turns procurement into sellable stock."
        actions={
          <>
            {canSuppliersWrite ? (
              <Button variant="outline" onClick={() => setSupplierDialog(true)}>
                Add supplier
              </Button>
            ) : null}
            {canPurchasesWrite ? <Button onClick={() => setPurchaseDialog(true)}>New purchase</Button> : null}
          </>
        }
      />

      <div className="space-y-6">
        {/* Suppliers */}
        {canSuppliersRead ? (
          <Card>
            <CardHeader
              title="Suppliers"
              subtitle={`${suppliers?.length ?? 0} recorded`}
            />
            {suppliersLoading ? (
              <TableSkeleton rows={4} cols={4} />
            ) : suppliersError ? (
              <ErrorState message={suppliersError.message} status={suppliersError.status} onRetry={reloadSuppliers} />
            ) : !suppliers || suppliers.length === 0 ? (
              <EmptyState title="No suppliers yet" description="Add your first supplier to start recording purchases." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH scope="col">Name</TH>
                    <TH scope="col">Location</TH>
                    <TH scope="col">Contact</TH>
                    <TH scope="col">Product SKUs</TH>
                  </TR>
                </THead>
                <TBody>
                  {suppliers.map((s) => (
                    <TR key={s.id}>
                      <TD className="font-medium">
                        {s.name}
                        {s.isDemo ? <span className="ml-2 rounded bg-honey/15 px-1 py-0.5 text-[10px] font-semibold text-honey-dark">DEMO</span> : null}
                      </TD>
                      <TD className="text-ink/70">{s.location ?? "—"}</TD>
                      <TD className="text-ink/70">
                        {[s.phone, s.email].filter(Boolean).join(" · ") || "—"}
                      </TD>
                      <TD className="max-w-[18rem] truncate font-mono text-xs text-ink/60" title={s.productSkus.join(", ")}>
                        {s.productSkus.length > 0 ? s.productSkus.join(", ") : "—"}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        ) : null}

        {/* Purchases */}
        {canPurchasesRead ? (
          <Card>
            <CardHeader title="Purchases" subtitle="Newest first · receiving requires purchases:write" />
            {purchasesLoading ? (
              <TableSkeleton rows={5} cols={6} />
            ) : purchasesError ? (
              <ErrorState message={purchasesError.message} status={purchasesError.status} onRetry={reloadPurchases} />
            ) : !purchases || purchases.length === 0 ? (
              <EmptyState title="No purchases yet" description="Create a purchase order to track procurement." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH scope="col">Reference</TH>
                    <TH scope="col">Supplier</TH>
                    <TH scope="col">Status</TH>
                    <TH scope="col">Lines</TH>
                    <TH scope="col">Received</TH>
                    <TH scope="col">Cost so far</TH>
                    <TH scope="col">Created</TH>
                    {canPurchasesWrite ? <TH scope="col">Actions</TH> : null}
                  </TR>
                </THead>
                <TBody>
                  {purchases.map((p) => {
                    const costPaise = p.items.reduce((sum, i) => sum + i.unitCostPaise * i.qtyOrdered, 0);
                    const receivable = p.status !== "cancelled" && p.status !== "received";
                    return (
                      <TR key={p.id}>
                        <TD className="font-semibold">{p.reference}</TD>
                        <TD className="text-ink/70">{supplierName(p.supplierId)}</TD>
                        <TD>
                          <StatusBadge status={p.status} />
                        </TD>
                        <TD>{p.items.length}</TD>
                        <TD>{receivedSummary(p)}</TD>
                        <TD>{formatINR(costPaise)}</TD>
                        <TD className="text-ink/60">{formatDate(p.createdAt)}</TD>
                        {canPurchasesWrite ? (
                          <TD>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!receivable || p.items.every((i) => i.qtyOrdered - i.qtyReceived <= 0)}
                              onClick={() => setReceiving(p)}
                            >
                              Receive
                            </Button>
                          </TD>
                        ) : null}
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </Card>
        ) : null}

        {!canSuppliersRead && !canPurchasesRead ? (
          <Card>
            <EmptyState
              title="No access"
              description="Your role does not include suppliers:read or purchases:read. Ask an owner to adjust your permissions."
            />
          </Card>
        ) : null}
      </div>

      <SupplierCreateDialog open={supplierDialog} onClose={() => setSupplierDialog(false)} onCreated={reloadSuppliers} />
      <PurchaseCreateDialog open={purchaseDialog} onClose={() => setPurchaseDialog(false)} suppliers={suppliers ?? []} onCreated={reloadPurchases} />
      <ReceiveDialog purchase={receiving} onClose={() => setReceiving(null)} onReceived={() => { reloadPurchases(); }} />
    </div>
  );
}
