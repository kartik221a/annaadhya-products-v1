/**
 * DashboardService — metric definitions are explicit and date-ranged.
 *
 * Definitions (documented in docs/api-specification.md):
 *  - gross sales        = sum of order totals for orders in range with paymentStatus succeeded (excl. refunds)
 *  - discounts          = sum of discountTotalPaise (currently 0 until campaign discounts ship)
 *  - refunds            = sum of refundPaise on refunded/refund-initiated orders in range
 *  - net sales          = gross − discounts − refunds
 *  - payments collected = sum of succeeded payment attempts in range (cash basis)
 *  - AOV                = net sales / paid order count
 *  - profit             = NOT CALCULATED until landed costs + expenses coverage is approved; reported as unavailable, never zero.
 *
 * Demo records are excluded from live reporting by default (settings.reporting).
 */
import { Inject, Injectable } from "@nestjs/common";
import { COLLECTIONS, type OrderDoc, type PaymentAttemptDoc, type SettingsDoc } from "@annaadhya/contracts";
import { availableQty, type ProductVariantDoc } from "@annaadhya/contracts";
import type { DataClient } from "@annaadhya/data-core";
import { addDays, startOfIstDay } from "@annaadhya/utils";
import { DATA_CLIENT } from "../../data/data.module";
import { SettingsService } from "../settings/settings.service";

export interface DashboardMetrics {
  range: { from: number; to: number; label: string };
  orders: { count: number; paidCount: number };
  grossSalesPaise: number;
  discountsPaise: number;
  refundsPaise: number;
  netSalesPaise: number;
  paymentsCollectedPaise: number;
  averageOrderValuePaise: number | null;
  profitPaise: null;
  profitNote: string;
  bestsellers: { sku: string; name: string; qty: number; revenuePaise: number }[];
  lowStock: { sku: string; available: number }[];
  recentOrders: { orderNumber: string; totalPaise: number; status: string; createdAt: number }[];
  salesTrend: { date: string; netSalesPaise: number; orders: number }[];
  demoDataIncluded: boolean;
}

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DATA_CLIENT) private readonly data: DataClient,
    private readonly settings: SettingsService,
  ) {}

  async metrics(days = 30): Promise<DashboardMetrics> {
    const settings: SettingsDoc = await this.settings.get();
    const includeDemo = settings.reporting.includeDemoDataByDefault;
    const to = Date.now();
    const from = startOfIstDay(addDays(to, -Math.max(1, days) + 1));

    const orders = (await this.data.list<OrderDoc>(COLLECTIONS.orders, {
      where: [{ field: "createdAt", op: ">=", value: from }],
      limit: 5000,
    })).filter((o) => (includeDemo ? true : !o.isDemo));

    const paid = orders.filter((o) => o.paymentStatus === "succeeded");
    const grossSales = paid.reduce((s, o) => s + o.totalPaise, 0);
    const discounts = paid.reduce((s, o) => s + o.discountTotalPaise, 0);
    const refunds = orders.reduce((s, o) => s + o.refundPaise, 0);
    const netSales = grossSales - discounts - refunds;

    const attempts = (await this.data.list<PaymentAttemptDoc>(COLLECTIONS.paymentAttempts, {
      where: [{ field: "createdAt", op: ">=", value: from }],
      limit: 5000,
    })).filter((a) => (includeDemo ? true : !a.isDemo));
    const collected = attempts
      .filter((a) => a.status === "succeeded")
      .reduce((s, a) => s + a.amountPaise, 0);

    // Bestsellers by qty across paid orders
    const bySku = new Map<string, { sku: string; name: string; qty: number; revenuePaise: number }>();
    for (const o of paid) {
      for (const item of o.items) {
        const agg = bySku.get(item.sku) ?? { sku: item.sku, name: item.name, qty: 0, revenuePaise: 0 };
        agg.qty += item.qty;
        agg.revenuePaise += item.lineTotalPaise;
        bySku.set(item.sku, agg);
      }
    }
    const bestsellers = [...bySku.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    const lowStockVariants = await this.data.list<ProductVariantDoc>(COLLECTIONS.productVariants, {
      where: [{ field: "status", op: "==", value: "published" }],
    });
    const lowStock = lowStockVariants
      .map((v) => ({ sku: v.sku, available: availableQty(v) }))
      .filter((v) => v.available <= 20)
      .sort((a, b) => a.available - b.available)
      .slice(0, 10);

    // Daily IST trend
    const trend = new Map<string, { date: string; netSalesPaise: number; orders: number }>();
    for (let i = 0; i < Math.max(1, days); i++) {
      const key = new Date(addDays(from, i)).toISOString().slice(0, 10);
      trend.set(key, { date: key, netSalesPaise: 0, orders: 0 });
    }
    for (const o of paid) {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      const bucket = trend.get(key);
      if (bucket) {
        bucket.netSalesPaise += o.totalPaise - o.discountTotalPaise - o.refundPaise;
        bucket.orders += 1;
      }
    }

    const aov = paid.length > 0 ? Math.round(netSales / paid.length) : null;

    return {
      range: { from, to, label: `last ${days} days` },
      orders: { count: orders.length, paidCount: paid.length },
      grossSalesPaise: grossSales,
      discountsPaise: discounts,
      refundsPaise: refunds,
      netSalesPaise: netSales,
      paymentsCollectedPaise: collected,
      averageOrderValuePaise: aov,
      profitPaise: null,
      profitNote:
        "Profit requires confirmed landed costs, expense coverage and a costing policy — shown as unavailable until the business supplies cost data.",
      bestsellers,
      lowStock,
      recentOrders: orders
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 8)
        .map((o) => ({ orderNumber: o.orderNumber, totalPaise: o.totalPaise, status: o.status, createdAt: o.createdAt })),
      salesTrend: [...trend.values()],
      demoDataIncluded: includeDemo,
    };
  }
}
