/** Customer self-service address book — authenticated owner-only, identity from the
 *  verified token (never a client-supplied id). Exposes the existing CustomersService
 *  address operations that previously had no HTTP surface. */
import { Body, Controller, Delete, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  savedAddressSchema,
  type AuthPrincipal,
  type CustomerDoc,
  type SavedAddressDto,
} from "@annaadhya/contracts";
import { CurrentUser } from "../../common/auth/guards";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import { CustomersService } from "./customers.service";

@ApiTags("customers")
@Controller("customers/me/addresses")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  /** Save a delivery address to the signed-in customer's own profile. */
  @Post()
  async addAddress(
    @Body(new ZodValidationPipe(savedAddressSchema)) dto: SavedAddressDto,
    @CurrentUser() principal: AuthPrincipal,
  ): Promise<CustomerDoc> {
    return this.customers.addAddress(principal, {
      label: dto.label,
      fullName: dto.fullName,
      phone: dto.phone,
      line1: dto.line1,
      line2: dto.line2 || undefined,
      landmark: dto.landmark || undefined,
      city: dto.city,
      state: dto.state,
      pincode: dto.pincode,
      isDefault: dto.isDefault,
    });
  }

  /** Remove an address from the signed-in customer's own profile. */
  @Delete(":addressId")
  async removeAddress(
    @Param("addressId") addressId: string,
    @CurrentUser() principal: AuthPrincipal,
  ): Promise<CustomerDoc> {
    return this.customers.removeAddress(principal, addressId);
  }
}
