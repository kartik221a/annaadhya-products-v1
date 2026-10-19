/** Orders — customer self-service + admin operations with server-enforced state machine. */
import { Inject, Injectable } from "@nestjs/common";
import {
  COLLECTIONS,
  ORDER_TRANSITIONS,
  type OrderDoc,
  type OrderStatus,
  type Page,
} from "@annaadhya/contracts";
import { AppError, badRequest, forbidden, notFound, type DataClient } from "@annaadhya/data-core";
import { nowMillis } from "@annaadhya/utils";
import { DATA_CLIENT } from "../../data/data.module";
import { AuditService } from "../audit/audit.service";
import type { OrderStatusUpdateDto, OrderRefundDto } from "@annaadhya/contracts";
import type { AuthPrincipal } from "@annaadhya/contracts";
import type { PaymentProvider } from "../payments/provider.interface";

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DATA_CLIENT) private readonly data: DataClient,
    private readonly audit: AuditService,
    private readonly providers: PaymentProvider[],
  ) {}

  /* ------------------------------- customer ------------------------------- */

  async listForCustomer(uid: string, page = 1, pageSize = 10): Promise<Page<OrderDoc>> {
    return this.paginateOrders([{ field: "customerUid", op: "==" as const, value: uid }], page, pageSize);
  }

  async getForCustomer(orderId: string, uid: string): Promise<OrderDoc> {
    const order = await this.data.get<OrderDoc>(COLLECTIONS.orders, orderId);
    if (!order || order.customerUid !== uid) throw notFound("Order not found");
    return order;
  }

  async getOrderByNumber(orderNumber: string): Promise<OrderDoc | null> {
    const rows = await this.data.list<OrderDoc>(COLLECTIONS.orders, {
      where: [{ field: "orderNumber", op: "==", value: orderNumber }],
      limit: 1,
    });
    return rows[0] ?? null;
  }

  /* --------------------------------- admin -------------------------------- */

  async listAdmin(filters: {
    search?: string;
    status?: OrderStatus;
    paymentStatus?: OrderDoc["paymentStatus"];
    from?: number;
    to?: number;
    page: number;
    pageSize: number;
  }): Promise<Page<OrderDoc>> {
    const where: { field: string; op: "==" | ">=" | "<="; value: unknown }[] = [];
    if (filters.status) where.push({ field: "status", op: "==", value: filters.status });
    if (filters.paymentStatus) where.push({ field: "paymentStatus", op: "==", value: filters.paymentStatus });
    if (filters.from) where.push({ field: "createdAt", op: ">=", value: filters.from });
    if (filters.to) where.push({ field: "createdAt", op: "<=", value: filters.to });

    let page = await this.paginateOrders(where, filters.page, filters.pageSize);
    if (filters.search) {
      const needle = filters.search.toLowerCase();
      page = {
        ...page,
        items: page.items.filter(
          (o) =>
            o.orderNumber.toLowerCase().includes(needle) ||
            o.customerContact.email?.toLowerCase().includes(needle) ||
            o.customerContact.phone?.includes(needle) ||
            o.customerContact.displayName.toLowerCase().includes(needle),
        ),
      };
    }
    return page;
  }

  private async paginateOrders(
    where: { field: string; op: "==" | ">=" | "<="; value: unknown }[],
    page: number,
    pageSize: number,
  ): Promise<Page<OrderDoc>> {
    const total = await this.data.count(COLLECTIONS.orders, where);
    const items = await this.data.list<OrderDoc>(COLLECTIONS.orders, {
      where,
      orderBy: [{ field: "createdAt", direction: "desc" }],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async getAdmin(orderId: string): Promise<OrderDoc> {
    const order = await this.data.get<OrderDoc>(COLLECTIONS.orders, orderId);
    if (!order) throw notFound("Order not found");
    return order;
  }

  async updateStatus(orderId: string, dto: OrderStatusUpdateDto, actor: AuthPrincipal): Promise<OrderDoc> {
    const order = await this.getAdmin(orderId);

    if (order.paymentStatus !== "succeeded" && dto.status !== "cancelled") {
      // Never allow an unpaid order to be pushed into fulfilment by editing a field.
      throw badRequest(
        "Only paid orders can move into fulfilment states. Payment must be verified by the provider first.",
      );
    }
    if (dto.status === "refunded" && actor.permissions && !actor.permissions.includes("orders:refund")) {
      throw forbidden("Refunds require the orders:refund permission");
    }
    this.assertTransition(order.status, dto.status);

    const patch: Partial<OrderDoc> = { status: dto.status, updatedAt: nowMillis() };
    if (dto.tracking) {
      patch.tracking = { ...dto.tracking, updatedAt: nowMillis() };
    }
    if (dto.status === "cancelled") {
      patch.cancelledReason = dto.reason ?? "cancelled_by_admin";
      await this.releaseReservations(orderId);
    }
    if (dto.status === "refunded") {
      throw badRequest("Use the refund endpoint to refund an order — this records provider refunds properly.");
    }

    await this.data.update(COLLECTIONS.orders, orderId, patch);
    await this.audit.record({
      actor,
      action: "order.status_change",
      targetType: "order",
      targetId: orderId,
      summary: `Order ${order.orderNumber}: ${order.status} → ${dto.status}${dto.tracking ? ` (tracking ${dto.tracking.carrier} ${dto.tracking.trackingNumber})` : ""}`,
      metadata: { from: order.status, to: dto.status },
    });
    return this.getAdmin(orderId);
  }

  async refund(orderId: string, dto: OrderRefundDto, actor: AuthPrincipal): Promise<OrderDoc> {
    const order = await this.getAdmin(orderId);
    if (!actor.permissions.includes("orders:refund")) throw forbidden("Refunds require the orders:refund permission");
    if (order.paymentStatus !== "succeeded") throw badRequest("Only paid orders can be refunded");
    if (dto.amountPaise > order.totalPaise - order.refundPaise) {
      throw badRequest("Refund exceeds the refundable balance");
    }

    // Record the refund through the provider when the provider supports it.
    if (order.paymentProvider !== "cod") {
      const provider = this.providers.find((p) => p.name === order.paymentProvider);
      if (provider?.refund) {
        const attempts = await this.data.list<{ providerPaymentId?: string }>(COLLECTIONS.paymentAttempts, {
          where: [{ field: "orderId", op: "==", value: orderId }],
          limit: 5,
        });
        const paymentId = attempts.find((a) => a.providerPaymentId)?.providerPaymentId;
        await provider.refund({ providerPaymentId: paymentId, amountPaise: dto.amountPaise });
      } else if (!provider) {
        throw new AppError("service_unconfigured", `Provider ${order.paymentProvider} is not available for refunds`, 503);
      }
    }

    const refundedTotal = order.refundPaise + dto.amountPaise;
    const fullRefund = refundedTotal >= order.totalPaise;
    await this.data.update(COLLECTIONS.orders, orderId, {
      refundPaise: refundedTotal,
      refundStatus: fullRefund ? "completed" : "initiated",
      paymentStatus: fullRefund ? "refunded" : order.paymentStatus,
      status: fullRefund ? "refunded" : order.status,
      updatedAt: nowMillis(),
    });
    await this.audit.record({
      actor,
      action: "order.refund",
      targetType: "order",
      targetId: orderId,
      summary: `Refund ₹${(dto.amountPaise / 100).toFixed(2)} on ${order.orderNumber}: ${dto.reason}`,
      metadata: { amountPaise: dto.amountPaise },
    });
    return this.getAdmin(orderId);
  }

  private async releaseReservations(orderId: string): Promise<void> {
    const reservations = await this.data.list<{ id: string; status: string }>(COLLECTIONS.stockReservations, {
      where: [{ field: "orderId", op: "==", value: orderId }],
    });
    for (const r of reservations) {
      if (r.status === "active") {
        await this.data.update(COLLECTIONS.stockReservations, r.id, { status: "released" });
      }
    }
  }

  assertTransition(from: OrderStatus, to: OrderStatus): void {
    const allowed = ORDER_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) throw badRequest(`Illegal order transition: ${from} → ${to}`);
  }
}
