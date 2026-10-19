/** Orders — customer endpoints + admin management with enforced transitions and refunds. */
import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  orderListQuerySchema,
  orderRefundSchema,
  orderStatusUpdateSchema,
  type AuthPrincipal,
  type OrderListQueryDto,
  type OrderRefundDto,
  type OrderStatusUpdateDto,
} from "@annaadhya/contracts";
import { CurrentUser, Protected, RequirePermissions } from "../../common/auth/guards";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import { OrdersService } from "./orders.service";
import { CheckoutService } from "../checkout/checkout.service";

@ApiTags("orders")
@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get("mine")
  async mine(
    @CurrentUser() principal: AuthPrincipal,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "10",
  ) {
    return this.orders.listForCustomer(principal.uid, Number(page) || 1, Math.min(50, Number(pageSize) || 10));
  }

  @Get("mine/:id")
  async mineOne(@Param("id") id: string, @CurrentUser() principal: AuthPrincipal) {
    return this.orders.getForCustomer(id, principal.uid);
  }
}

@ApiTags("admin-orders")
@Controller("admin/orders")
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly checkout: CheckoutService,
  ) {}

  @Get()
  @Protected("orders:read")
  @RequirePermissions("orders:read")
  async list(@Query(new ZodValidationPipe(orderListQuerySchema)) q: OrderListQueryDto) {
    return this.orders.listAdmin(q);
  }

  @Get("state-machine")
  @Protected("orders:read")
  @RequirePermissions("orders:read")
  async stateMachine() {
    const { ORDER_TRANSITIONS } = await import("@annaadhya/contracts");
    return ORDER_TRANSITIONS;
  }

  @Get(":id")
  @Protected("orders:read")
  @RequirePermissions("orders:read")
  async getOne(@Param("id") id: string) {
    return this.orders.getAdmin(id);
  }

  @Post(":id/status")
  @Protected("orders:write")
  @RequirePermissions("orders:write")
  async updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(orderStatusUpdateSchema)) dto: OrderStatusUpdateDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.orders.updateStatus(id, dto, actor);
  }

  @Post(":id/refund")
  @Protected("orders:refund")
  @RequirePermissions("orders:refund")
  async refund(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(orderRefundSchema)) dto: OrderRefundDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.orders.refund(id, dto, actor);
  }

  /** Maintenance: release expired stock reservations (also runs on a schedule). */
  @Post("reservations/release-expired")
  @Protected("orders:write")
  @RequirePermissions("orders:write")
  async releaseExpired() {
    return this.checkout.releaseExpiredReservations();
  }
}
