/**
 * AuthService — derives identity ONLY from verified credentials.
 *
 * Production: Firebase ID tokens are verified with the Admin SDK (verifyIdToken). The client
 * never supplies trusted user ids directly.
 * Mock mode (no Firebase credentials, non-production): dev tokens are HMAC-signed by
 * `issueDevToken` and verified with the same strictness. Mock mode is disabled in production
 * by the env layer.
 *
 * Staff roles are resolved from the `adminUsers` collection — never from token claims submitted
 * by a browser. Customers are lazily upserted into `customers` keyed by Firebase UID.
 */
import { Injectable } from "@nestjs/common";
import { COLLECTIONS, type AdminRole, type AdminUserDoc, type AuthPrincipal, type CustomerDoc, permissionsForRole } from "@annaadhya/contracts";
import { AppError, type DataClient } from "@annaadhya/data-core";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { ApiEnv } from "../../config/env";

interface DevTokenPayload {
  uid: string;
  email?: string;
  phone?: string;
  displayName?: string;
  provider: string;
  iat: number;
  exp: number;
}

const DEV_TOKEN_TTL_SECONDS = 60 * 60 * 12;

@Injectable()
export class AuthService {
  private firebaseAuth: import("firebase-admin/auth").Auth | null = null;

  constructor(
    private readonly data: DataClient,
    private readonly env: ApiEnv,
  ) {}

  /** Verify a bearer token and resolve the principal (including staff role lookup). */
  async verifyPrincipal(token: string): Promise<AuthPrincipal> {
    let uid: string;
    let email: string | undefined;
    let phone: string | undefined;
    let displayName: string | undefined;
    let provider: string;

    if (this.env.firebaseConfigured) {
      const decoded = await this.verifyFirebaseIdToken(token);
      uid = decoded.uid;
      email = decoded.email;
      phone = decoded.phone_number;
      displayName = decoded.name;
      provider = decoded.firebase?.sign_in_provider ?? "unknown";
    } else {
      if (this.env.isProduction) {
        throw new AppError("service_unconfigured", "Authentication is not configured on this server", 503);
      }
      const payload = this.verifyDevToken(token);
      uid = payload.uid;
      email = payload.email;
      phone = payload.phone;
      displayName = payload.displayName;
      provider = payload.provider;
    }

    const staff = await this.loadStaff(uid);
    const role: AdminRole | "customer" = staff?.role ?? "customer";
    return {
      uid,
      email: email ?? staff?.email,
      phone,
      displayName: displayName ?? staff?.displayName,
      provider,
      role,
      permissions: role === "customer" ? [] : [...permissionsForRole(role)],
      isStaff: role !== "customer",
    };
  }

  private async verifyFirebaseIdToken(
    token: string,
  ): Promise<{ uid: string; email?: string; phone_number?: string; name?: string; firebase?: { sign_in_provider?: string } }> {
    try {
      if (!this.firebaseAuth) {
        const { getAuth } = await import("firebase-admin/auth");
        const { getApp } = await import("firebase-admin/app");
        this.firebaseAuth = getAuth(getApp("annaadhya"));
      }
      return await this.firebaseAuth.verifyIdToken(token, true);
    } catch (err) {
      throw new AppError(
        "unauthenticated",
        `Invalid or expired credentials: ${err instanceof Error ? err.message : "unknown error"}`,
        401,
      );
    }
  }

  /* ----------------------------- dev tokens ------------------------------ */

  /** Issues a mock-mode session token. NEVER callable when Firebase is configured or in production. */
  issueDevToken(input: {
    uid: string;
    email?: string;
    phone?: string;
    displayName?: string;
    provider?: string;
  }): { token: string; expiresIn: number } {
    if (this.env.isProduction || this.env.firebaseConfigured) {
      throw new AppError("forbidden", "Dev tokens are only available in mock-mode development", 403);
    }
    const secret = this.env.DEV_TOKEN_SECRET!;
    const now = Math.floor(Date.now() / 1000);
    const payload: DevTokenPayload = {
      uid: input.uid,
      email: input.email,
      phone: input.phone,
      displayName: input.displayName,
      provider: input.provider ?? "dev",
      iat: now,
      exp: now + DEV_TOKEN_TTL_SECONDS,
    };
    const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const sig = createHmac("sha256", secret).update(body).digest("base64url");
    return { token: `${body}.${sig}`, expiresIn: DEV_TOKEN_TTL_SECONDS };
  }

  private verifyDevToken(token: string): DevTokenPayload {
    const secret = this.env.DEV_TOKEN_SECRET!;
    const [body, sig] = token.split(".");
    if (!body || !sig) throw new AppError("unauthenticated", "Malformed token", 401);
    const expected = createHmac("sha256", secret).update(body).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new AppError("unauthenticated", "Invalid token signature", 401);
    }
    let payload: DevTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DevTokenPayload;
    } catch {
      throw new AppError("unauthenticated", "Malformed token", 401);
    }
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      throw new AppError("unauthenticated", "Token expired", 401);
    }
    return payload;
  }

  /* ------------------------------- lookups ------------------------------- */

  async loadStaff(uid: string): Promise<AdminUserDoc | null> {
    const docs = await this.data.list<AdminUserDoc>(COLLECTIONS.adminUsers, {
      where: [{ field: "uid", op: "==", value: uid }],
      limit: 1,
    });
    const staff = docs[0];
    if (!staff) return null;
    if (staff.status !== "active") {
      throw new AppError("forbidden", "This staff account is suspended", 403);
    }
    return staff;
  }

  /** Ensures a customer profile exists for the verified principal (keyed by UID). */
  async upsertCustomerFromPrincipal(p: {
    uid: string;
    email?: string;
    phone?: string;
    displayName?: string;
    provider: string;
  }): Promise<CustomerDoc> {
    const existing = await this.data.list<CustomerDoc>(COLLECTIONS.customers, {
      where: [{ field: "uid", op: "==", value: p.uid }],
      limit: 1,
    });
    const now = Date.now();
    if (existing[0]) {
      const doc = existing[0];
      const providers = new Set([...(doc.providers ?? []), p.provider]);
      const patch: Partial<CustomerDoc> = {
        providers: [...providers],
        email: doc.email ?? p.email,
        phone: doc.phone ?? p.phone,
        displayName: doc.displayName ?? p.displayName ?? "Customer",
      };
      return this.data.update(COLLECTIONS.customers, doc.id, patch);
    }
    return this.data.create<CustomerDoc>(
      COLLECTIONS.customers,
      {
        uid: p.uid,
        displayName: p.displayName ?? p.email?.split("@")[0] ?? "Customer",
        email: p.email,
        phone: p.phone,
        providers: [p.provider],
        accountStatus: "active",
        addresses: [],
        marketingOptIn: false,
      } as object as CustomerDoc,
      { id: `cust_${p.uid.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 28)}` },
    );
  }
}
