/** Auth — token verification, session profile, dev-token issuance (mock mode only), owner bootstrap. */
import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  bootstrapOwnerSchema,
  profileUpdateSchema,
  type AuthPrincipal,
  type BootstrapOwnerDto,
} from "@annaadhya/contracts";
import { CurrentUser, Public } from "../../common/auth/guards";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import { AuthService } from "../../common/auth/auth.service";
import { CustomersService } from "../customers/customers.service";
import { TeamService } from "../team/team.service";
import { SettingsService } from "../settings/settings.service";
import type { ApiEnv } from "../../config/env";

const devTokenSchema = z.object({
  uid: z.string().min(4).max(128),
  email: z.string().email().optional(),
  displayName: z.string().max(120).optional(),
  provider: z.enum(["google", "password", "phone", "dev"]).default("dev"),
});

const verifySchema = z.object({ idToken: z.string().min(10).max(4096) });

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly customers: CustomersService,
    private readonly team: TeamService,
    private readonly settings: SettingsService,
    private readonly env: ApiEnv,
  ) {}

  /** Exchange a verified credential for the app session identity; lazily provisions the customer profile. */
  @Public()
  @Post("verify")
  async verify(@Body(new ZodValidationPipe(verifySchema)) body: { idToken: string }) {
    const principal = await this.auth.verifyPrincipal(body.idToken);
    const customer = principal.isStaff ? null : await this.customers.me(principal);
    const staff = await this.auth.loadStaff(principal.uid);
    return { principal, customer, staff, mode: this.modeDescriptor() };
  }

  @Get("me")
  async me(@CurrentUser() principal: AuthPrincipal) {
    const customer = principal.isStaff ? null : await this.customers.me(principal);
    return { principal, customer };
  }

  @Post("profile")
  async updateProfile(
    @Body(new ZodValidationPipe(profileUpdateSchema)) dto: z.infer<typeof profileUpdateSchema>,
    @CurrentUser() principal: AuthPrincipal,
  ) {
    return this.customers.updateMe(principal, dto);
  }

  /** Mock-mode session issuance for development/testing. Refused whenever real auth is configured. */
  @Public()
  @Post("dev/token")
  async devToken(
    @Body(new ZodValidationPipe(devTokenSchema)) body: { uid: string; email?: string; displayName?: string; provider: string },
  ) {
    if (this.env.firebaseConfigured || this.env.isProduction) {
      throw Object.assign(new Error("Dev tokens are disabled when real authentication is configured"), { status: 403 });
    }
    const issued = this.auth.issueDevToken(body);
    const principal = await this.auth.verifyPrincipal(issued.token);
    const staff = await this.auth.loadStaff(principal.uid);
    return { ...issued, principal, staff, mode: this.modeDescriptor() };
  }

  /** One-time owner provisioning (documented bootstrap; guarded by ADMIN_SETUP_KEY). */
  @Public()
  @Post("bootstrap-owner")
  async bootstrapOwner(@Body(new ZodValidationPipe(bootstrapOwnerSchema)) dto: BootstrapOwnerDto) {
    const staff = await this.team.bootstrapOwner(dto);
    return { created: true, staff };
  }

  @Get("platform-status")
  @Public()
  async platformStatus() {
    const settings = await this.settings.get();
    return {
      mode: this.modeDescriptor(),
      paymentsSandbox: settings.payments.sandboxMode,
      codEnabled: settings.payments.codEnabled,
    };
  }

  private modeDescriptor() {
    return {
      dataProvider: this.env.DATA_PROVIDER,
      authentication: this.env.firebaseConfigured ? ("firebase" as const) : ("mock-dev-tokens" as const),
      payments: this.env.PAYMENT_PROVIDER,
      razorpayConfigured: this.env.razorpayConfigured,
      cloudinaryConfigured: this.env.cloudinaryConfigured,
      sandbox: !this.env.isProduction,
    };
  }
}
