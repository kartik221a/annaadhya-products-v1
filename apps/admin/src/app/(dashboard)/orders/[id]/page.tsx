"use client";
/**
 * /orders/[id] — order detail.
 * - GET /admin/orders/:id (OrderDoc) + GET /admin/orders/state-machine (legal transitions)
 * - Status changes only offer legal transitions; `refunded` is intentionally not offered here
 *   (the API insists refunds go through POST :id/refund, which also settles provider refunds).
 * - Tracking inputs appear when moving to `shipped`; refund form needs orders:refund.
 * - Shipped/delivered orders can have their tracking corrected (PATCH :id/tracking) —
 *   typo'd AWB or rebooked courier — without touching status or payment.
 * - API errors (e.g. "unpaid orders can't be fulfilled") are surfaced verbatim.
 */
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError, apiGet, apiPatch, apiPost, can } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApiQuery, usePageTitle } from "@/lib/hooks";
import { formatDateTime, formatINR, humanize, rupeesToPaise } from "@/lib/format";
import { useToast } from "@/lib/toast";
import type { OrderDoc, OrderStatus } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";

type TransitionMap = Record<string, string[]>;

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id ?? "";
  const { principal } = useAuth();
  const toast = useToast();
  usePageTitle("Order detail");

  const canRefund = can(principal, "orders:refund");
  const canWrite = can(principal, "orders:write");

  const { data: order, loading, error, reload } = useApiQuery<OrderDoc>(
    () => apiGet<OrderDoc>(`/admin/orders/${orderId}`),
    [orderId],
  );
  const { data: transitions } = useApiQuery<TransitionMap>(() => apiGet("/admin/orders/state-machine"));

  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [reason, setReason] = useState("");

  // tracking correction state (shipped/delivered orders; prefilled from the current record)
  const [trackingEditOpen, setTrackingEditOpen] = useState(false);
  const [editCarrier, setEditCarrier] = useState("");
  const [editAwb, setEditAwb] = useState("");

  // refund form state (rupees input, converted at submit)
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  async function changeStatus(to: OrderStatus) {
    if (!order) return;
    setActionError(null);
    const needsTracking = to === "shipped";
    if (needsTracking && (carrier.trim().length < 1 || trackingNumber.trim().length < 3)) {
      setActionError("Carrier and a tracking number (3+ chars) are required to mark an order shipped.");
      return;
    }
    setBusy(true);
    try {
      await apiPost(`/admin/orders/${order.id}/status`, {
        status: to,
        reason: reason.trim() || undefined,
        tracking: needsTracking
          ? { carrier: carrier.trim(), trackingNumber: trackingNumber.trim() }
          : undefined,
      });
      toast.success("Order updated", `${order.orderNumber} → ${humanize(to)}`);
      setTarget(null);
      setReason("");
      reload();
    } catch (err) {
      // e.g. "Only paid orders can move into fulfilment states…" — show it verbatim.
      setActionError(err instanceof ApiError ? err.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  async function submitTracking(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    setActionError(null);
    if (editCarrier.trim().length < 1 || editAwb.trim().length < 3) {
      setActionError("Carrier and a tracking number (3+ chars) are required.");
      return;
    }
    setBusy(true);
    try {
      await apiPatch(`/admin/orders/${order.id}/tracking`, {
        carrier: editCarrier.trim(),
        trackingNumber: editAwb.trim(),
      });
      toast.success("Tracking updated", `${order.orderNumber} · ${editCarrier.trim()} ${editAwb.trim()}`);
      setTrackingEditOpen(false);
      reload();
    } catch (err) {
      // e.g. "Tracking can only be corrected on shipped or delivered orders…" — show it verbatim.
      setActionError(err instanceof ApiError ? err.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  async function submitRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    setActionError(null);
    const amountPaise = rupeesToPaise(refundAmount);
    if (Number.isNaN(amountPaise) || amountPaise <= 0) {
      setActionError("Enter a refund amount greater than ₹0.");
      return;
    }
    if (refundReason.trim().length < 3) {
      setActionError("A reason of at least 3 characters is required for refunds.");
      return;
    }
    setBusy(true);
    try {
      await apiPost(`/admin/orders/${order.id}/refund`, { amountPaise, reason: refundReason.trim() });
      toast.success("Refund recorded", `${formatINR(amountPaise)} on ${order.orderNumber}`);
      setRefundOpen(false);
      setRefundAmount("");
      setRefundReason("");
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <TableSkeleton rows={8} cols={5} />
      </Card>
    );
  }
  if (error || !order) {
    return (
      <Card>
        <ErrorState message={error?.message ?? "Order not found"} status={error?.status} onRetry={reload} />
      </Card>
    );
  }

  const legalTargets = (transitions?.[order.status] ?? []).filter((t) => t !== "refunded");
  const refundablePaise = Math.max(0, order.totalPaise - order.refundPaise);
  const unpaid = order.paymentStatus !== "succeeded";

  return (
    <div>
      <PageHeader
        title={order.orderNumber}
        description={
          <>
            Placed {formatDateTime(order.createdAt)} · {order.items.length} item{order.items.length === 1 ? "" : "s"} ·{" "}
            {order.isDemo ? "demo record · " : ""}provider {humanize(order.paymentProvider)}
          </>
        }
        actions={
          <>
            <StatusBadge status={order.status} />
            <StatusBadge status={order.paymentStatus} />
            <Link href="/orders">
              <Button variant="outline">All orders</Button>
            </Link>
          </>
        }
      />

      {actionError ? (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {actionError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Items + totals */}
        <Card className="xl:col-span-2">
          <CardHeader title="Items" subtitle="Historical snapshot — the exact name/price/SKU at purchase time" />
          <Table>
            <THead>
              <TR>
                <TH scope="col">Item</TH>
                <TH scope="col">SKU</TH>
                <TH scope="col">Qty</TH>
                <TH scope="col">Unit price</TH>
                <TH scope="col">Line total</TH>
              </TR>
            </THead>
            <TBody>
              {order.items.map((item) => (
                <TR key={`${item.variantId}-${item.sku}`}>
                  <TD className="max-w-[18rem] truncate font-medium" title={`${item.name} — ${item.variantLabel}`}>
                    {item.name}
                    <span className="block text-xs text-ink/50">{item.variantLabel}</span>
                  </TD>
                  <TD className="font-mono text-xs">{item.sku}</TD>
                  <TD>{item.qty}</TD>
                  <TD>{formatINR(item.unitPricePaise)}</TD>
                  <TD className="font-semibold">{formatINR(item.lineTotalPaise)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <CardBody className="border-t border-sand">
            <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-ink/60">Subtotal</dt>
                <dd>{formatINR(order.subtotalPaise)}</dd>
              </div>
              {order.discountTotalPaise > 0 ? (
                <div className="flex justify-between gap-6">
                  <dt className="text-ink/60">Discounts</dt>
                  <dd>−{formatINR(order.discountTotalPaise)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-6">
                <dt className="text-ink/60">Shipping</dt>
                <dd>{formatINR(order.shippingPaise)}</dd>
              </div>
              {order.taxPaise > 0 ? (
                <div className="flex justify-between gap-6">
                  <dt className="text-ink/60">{order.taxLabel ?? "Tax"}</dt>
                  <dd>{formatINR(order.taxPaise)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-6 border-t border-sand pt-1.5 font-display text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatINR(order.totalPaise)}</dd>
              </div>
              {order.refundPaise > 0 ? (
                <div className="flex justify-between gap-6 text-red-700">
                  <dt>Refunded ({humanize(order.refundStatus)})</dt>
                  <dd>−{formatINR(order.refundPaise)}</dd>
                </div>
              ) : null}
            </dl>
          </CardBody>
        </Card>

        {/* Right column: customer, address, actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Customer" />
            <CardBody className="space-y-1 text-sm">
              <p className="font-semibold">{order.customerContact.displayName}</p>
              <p className="text-ink/70">{order.customerContact.email || "—"}</p>
              <p className="text-ink/70">{order.customerContact.phone || "—"}</p>
              {order.isGiftOrder ? <p className="pt-1 text-xs font-medium text-honey-dark">🎁 Gift order</p> : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Shipping address" />
            <CardBody className="space-y-0.5 text-sm text-ink/80">
              <p className="font-medium text-ink">{order.shippingAddress.fullName}</p>
              <p>{order.shippingAddress.line1}</p>
              {order.shippingAddress.line2 ? <p>{order.shippingAddress.line2}</p> : null}
              {order.shippingAddress.landmark ? <p>Landmark: {order.shippingAddress.landmark}</p> : null}
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.pincode}
              </p>
              <p className="text-ink/60">{order.shippingAddress.phone}</p>
            </CardBody>
          </Card>

          {order.tracking || ((order.status === "shipped" || order.status === "delivered") && canWrite) ? (
            <Card>
              <CardHeader
                title="Tracking"
                subtitle="The customer's Track Order button opens Shiprocket with this AWB"
                actions={
                  canWrite && !trackingEditOpen ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditCarrier(order.tracking?.carrier ?? "");
                        setEditAwb(order.tracking?.trackingNumber ?? "");
                        setTrackingEditOpen(true);
                      }}
                    >
                      {order.tracking ? "Edit" : "Add tracking"}
                    </Button>
                  ) : null
                }
              />
              <CardBody className="text-sm">
                {order.tracking ? (
                  <>
                    <p className="font-medium">{order.tracking.carrier}</p>
                    <p className="font-mono text-xs text-ink/70">{order.tracking.trackingNumber}</p>
                    <p className="mt-1 text-xs text-ink/50">Updated {formatDateTime(order.tracking.updatedAt)}</p>
                  </>
                ) : (
                  <p className="text-ink/60">
                    No tracking recorded yet — add the courier and AWB once the shipment is booked.
                  </p>
                )}
                {trackingEditOpen ? (
                  <form
                    className="mt-3 space-y-3 rounded-md border border-sand bg-cream/50 p-3"
                    onSubmit={submitTracking}
                  >
                    <p className="text-sm font-semibold">Correct shipment tracking</p>
                    <Field label="Carrier" required>
                      <Input value={editCarrier} onChange={(e) => setEditCarrier(e.target.value)} placeholder="Delhivery / Bluedart…" required />
                    </Field>
                    <Field label="Tracking number" required>
                      <Input value={editAwb} onChange={(e) => setEditAwb(e.target.value)} placeholder="AWB…" required minLength={3} />
                    </Field>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setTrackingEditOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" loading={busy}>
                        Save tracking
                      </Button>
                    </div>
                  </form>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {order.cancelledReason ? (
            <Card>
              <CardHeader title="Cancellation" />
              <CardBody className="text-sm text-ink/70">{order.cancelledReason}</CardBody>
            </Card>
          ) : null}

          {canWrite ? (
            <Card>
              <CardHeader
                title="Update status"
                subtitle={
                  unpaid
                    ? "Payment not succeeded yet — fulfilment states are blocked by the API until the provider verifies payment."
                    : "Only transitions the state machine allows are offered."
                }
              />
              <CardBody className="space-y-3">
                {legalTargets.length === 0 ? (
                  <p className="text-sm text-ink/60">No further transitions from {humanize(order.status)}.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {legalTargets.map((t) => (
                      <Button key={t} variant={t === "cancelled" ? "outline" : "primary"} size="sm" onClick={() => setTarget(t as OrderStatus)}>
                        Mark {humanize(t)}
                      </Button>
                    ))}
                  </div>
                )}
                {order.status === "pending_payment" ? (
                  <p className="rounded-md bg-cream p-2.5 text-xs text-ink/60">
                    `confirmed` is reached through verified payment (webhook / provider verify), never by manual edit of
                    an unpaid order. Cancel is the manual option here.
                  </p>
                ) : null}
                {(transitions?.[order.status] ?? []).includes("refunded") && canRefund ? (
                  <p className="text-xs text-ink/50">
                    Refunds for this state go through the refund form below so provider refunds are recorded properly.
                  </p>
                ) : null}

                {target ? (
                  <form
                    className="space-y-3 rounded-md border border-sand bg-cream/50 p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (target) void changeStatus(target);
                    }}
                  >
                    <p className="text-sm font-semibold">
                      Move {order.orderNumber} → {humanize(target)}
                    </p>
                    {target === "shipped" ? (
                      <>
                        <Field label="Carrier" required>
                          <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Delhivery / Bluedart…" required />
                        </Field>
                        <Field label="Tracking number" required>
                          <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="AWB…" required minLength={3} />
                        </Field>
                      </>
                    ) : null}
                    {target === "cancelled" ? (
                      <Field label="Reason" hint="Recorded as the cancellation reason">
                        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} />
                      </Field>
                    ) : null}
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setTarget(null)}>
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" loading={busy}>
                        Confirm
                      </Button>
                    </div>
                  </form>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {canRefund ? (
            <Card>
              <CardHeader
                title="Refund"
                subtitle={`Refundable balance: ${formatINR(refundablePaise)}`}
                actions={
                  !refundOpen && refundablePaise > 0 && order.paymentStatus === "succeeded" ? (
                    <Button variant="secondary" size="sm" onClick={() => setRefundOpen(true)}>
                      Refund…
                    </Button>
                  ) : null
                }
              />
              <CardBody>
                {order.paymentStatus !== "succeeded" ? (
                  <p className="text-sm text-ink/60">Only paid orders can be refunded.</p>
                ) : refundablePaise === 0 ? (
                  <p className="text-sm text-ink/60">Fully refunded.</p>
                ) : refundOpen ? (
                  <form className="space-y-3" onSubmit={submitRefund}>
                    <Field label="Amount (₹)" required hint={`Max ${formatINR(refundablePaise)} — entered in rupees`}>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        placeholder={(refundablePaise / 100).toFixed(2)}
                        required
                      />
                    </Field>
                    <Field label="Reason" required>
                      <Textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} rows={2} maxLength={300} required />
                    </Field>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setRefundOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" variant="danger" loading={busy}>
                        Record refund
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="text-sm text-ink/60">
                    Refunds are recorded via POST :id/refund and settled through the payment provider where supported.
                  </p>
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
