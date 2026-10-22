/**
 * Customers — profile self-service (owner-only access) + admin support views with
 * restricted personal-data exposure. Customers can only ever read/update their own record,
 * derived from the verified token (never a client-supplied id).
 */
import { Inject, Injectable } from "@nestjs/common";
import { COLLECTIONS, type CustomerDoc, type ProfileUpdateDto, type AuthPrincipal } from "@annaadhya/contracts";
import { forbidden, notFound, type DataClient } from "@annaadhya/data-core";
import { newId } from "@annaadhya/utils";
import { DATA_CLIENT } from "../../data/data.module";

@Injectable()
export class CustomersService {
  constructor(@Inject(DATA_CLIENT) private readonly data: DataClient) {}

  async me(principal: AuthPrincipal): Promise<CustomerDoc> {
    const rows = await this.data.list<CustomerDoc>(COLLECTIONS.customers, {
      where: [{ field: "uid", op: "==", value: principal.uid }],
      limit: 1,
    });
    if (rows[0]) return rows[0];
    // Lazily provision the customer profile on first authenticated call
    const created = await this.data.create<CustomerDoc>(
      COLLECTIONS.customers,
      {
        uid: principal.uid,
        displayName: principal.displayName ?? principal.email?.split("@")[0] ?? "Customer",
        email: principal.email,
        phone: principal.phone,
        providers: [principal.provider],
        accountStatus: "active",
        addresses: [],
        marketingOptIn: false,
      } as object as CustomerDoc,
      { id: `cust_${principal.uid.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 28)}` },
    );
    return created;
  }

  async updateMe(principal: AuthPrincipal, dto: ProfileUpdateDto): Promise<CustomerDoc> {
    const me = await this.me(principal);
    return this.data.update(COLLECTIONS.customers, me.id, {
      displayName: dto.displayName ?? me.displayName,
      phone: dto.phone === "" ? undefined : (dto.phone ?? me.phone),
      marketingOptIn: dto.marketingOptIn ?? me.marketingOptIn,
      updatedAt: Date.now(),
    } as Partial<CustomerDoc>);
  }

  async addAddress(principal: AuthPrincipal, address: Omit<CustomerDoc["addresses"][number], "id">): Promise<CustomerDoc> {
    const me = await this.me(principal);
    const addresses = [...me.addresses];
    // newId() is monotonic-ish and collision-safe — the previous Date.now-based id made
    // two addresses saved within the same millisecond share an id (data corruption).
    const id = newId("addr");
    // The first saved address becomes the default automatically; an explicit isDefault
    // request demotes every other address so exactly one default exists at any time.
    const shouldBeDefault = address.isDefault || addresses.length === 0;
    addresses.push({ ...address, id, isDefault: shouldBeDefault });
    if (shouldBeDefault) {
      for (const a of addresses) a.isDefault = a.id === id;
    }
    const patch: Partial<CustomerDoc> = { addresses, updatedAt: Date.now() };
    if (shouldBeDefault) patch.defaultAddressId = id;
    return this.data.update(COLLECTIONS.customers, me.id, patch);
  }

  async removeAddress(principal: AuthPrincipal, addressId: string): Promise<CustomerDoc> {
    const me = await this.me(principal);
    const removed = me.addresses.find((a) => a.id === addressId);
    const addresses = me.addresses.filter((a) => a.id !== addressId);
    const patch: Partial<CustomerDoc> = { addresses, updatedAt: Date.now() };
    // Removing the default must not leave the book defaultless — promote the first survivor.
    if (removed?.isDefault && addresses.length > 0) {
      addresses[0] = { ...addresses[0], isDefault: true };
      patch.defaultAddressId = addresses[0].id;
    }
    return this.data.update(COLLECTIONS.customers, me.id, patch);
  }

  /** Edit an existing address (full replacement of its fields) and/or make it the default.
   *  Default invariant mirrors addAddress: exactly one isDefault address at any time, and
   *  demoting the current default promotes the first survivor so the book never loses its
   *  default (checkout prefill depends on one existing). */
  async updateAddress(
    principal: AuthPrincipal,
    addressId: string,
    dto: Omit<CustomerDoc["addresses"][number], "id">,
  ): Promise<CustomerDoc> {
    const me = await this.me(principal);
    const existing = me.addresses.find((a) => a.id === addressId);
    if (!existing) throw notFound("Address not found");
    const addresses = me.addresses.map((a) => ({ ...a }));
    if (dto.isDefault) {
      for (const a of addresses) a.isDefault = a.id === addressId;
    } else if (existing.isDefault && addresses.length > 1) {
      // Demoting the default: promote the first other address so a default always exists.
      const survivor = addresses.find((a) => a.id !== addressId)!;
      survivor.isDefault = true;
    }
    const target = addresses.find((a) => a.id === addressId)!;
    target.label = dto.label;
    target.fullName = dto.fullName;
    target.phone = dto.phone;
    target.line1 = dto.line1;
    target.line2 = dto.line2;
    target.landmark = dto.landmark;
    target.city = dto.city;
    target.state = dto.state;
    target.pincode = dto.pincode;
    target.isDefault = dto.isDefault || (existing.isDefault && addresses.length === 1);
    const patch: Partial<CustomerDoc> = { addresses, updatedAt: Date.now() };
    const newDefault = addresses.find((a) => a.isDefault);
    if (newDefault) patch.defaultAddressId = newDefault.id;
    return this.data.update(COLLECTIONS.customers, me.id, patch);
  }

  /** Request account deletion — records the request; execution is a documented manual GDPR-style process. */
  async requestDeletion(principal: AuthPrincipal): Promise<{ received: true }> {
    const me = await this.me(principal);
    await this.data.update(COLLECTIONS.customers, me.id, {
      accountStatus: "suspended",
      notes: `${me.notes ? `${me.notes}\n` : ""}[${new Date().toISOString()}] Account deletion requested by customer.`,
      updatedAt: Date.now(),
    } as Partial<CustomerDoc>);
    return { received: true };
  }

  /* --------------------------------- admin -------------------------------- */

  async listAdmin(opts: { search?: string; limit?: number } = {}): Promise<CustomerDoc[]> {
    const rows = await this.data.list<CustomerDoc>(COLLECTIONS.customers, {
      orderBy: [{ field: "createdAt", direction: "desc" }],
      limit: opts.limit ?? 200,
    });
    if (!opts.search) return rows;
    const needle = opts.search.toLowerCase();
    return rows.filter(
      (c) =>
        c.displayName.toLowerCase().includes(needle) ||
        c.email?.toLowerCase().includes(needle) ||
        c.phone?.includes(needle),
    );
  }

  /** Admin view with PII minimisation: masks phone/email for roles without customers:write. */
  maskForRole(doc: CustomerDoc, permissions: string[]): CustomerDoc {
    if (permissions.includes("customers:write")) return doc;
    return {
      ...doc,
      email: doc.email ? maskEmail(doc.email) : undefined,
      phone: doc.phone ? `${doc.phone.slice(0, 3)}xxxxx${doc.phone.slice(-2)}` : undefined,
      addresses: [],
    };
  }

  async getAdmin(id: string): Promise<CustomerDoc> {
    const doc = await this.data.get<CustomerDoc>(COLLECTIONS.customers, id);
    if (!doc) throw notFound("Customer not found");
    return doc;
  }

  async setStatus(id: string, status: CustomerDoc["accountStatus"]): Promise<CustomerDoc> {
    await this.getAdmin(id);
    return this.data.update(COLLECTIONS.customers, id, { status, updatedAt: Date.now() } as Partial<CustomerDoc>);
  }

  assertNotSelf(action: string, actor: AuthPrincipal, targetUid: string): void {
    if (actor.uid === targetUid) throw forbidden(`Cannot ${action} your own account through this endpoint`);
  }
}

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return "***";
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}
