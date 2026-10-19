/** Public catalogue + admin product/category management (permission-checked, audited). */
import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  categoryUpsertSchema,
  listQuerySchema,
  productUpsertSchema,
  type AuthPrincipal,
  type CategoryUpsertDto,
  type ListQueryDto,
  type ProductUpsertDto,
} from "@annaadhya/contracts";
import { CurrentUser, Protected, Public, RequirePermissions } from "../../common/auth/guards";
import { ZodValidationPipe } from "../../common/validation/zod.pipe";
import { CatalogueService } from "./catalogue.service";
import { AuditService } from "../audit/audit.service";

@ApiTags("catalogue")
@Controller()
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Public()
  @Get("categories")
  async categories() {
    return this.catalogue.listCategories(false);
  }

  @Public()
  @Get("categories/:slug")
  async category(@Param("slug") slug: string) {
    return this.catalogue.getCategoryBySlug(slug);
  }

  @Public()
  @Get("products")
  async products(@Query(new ZodValidationPipe(listQuerySchema)) q: ListQueryDto) {
    return this.catalogue.listProducts(q);
  }

  @Public()
  @Get("products/bestsellers")
  async bestsellers() {
    return this.catalogue.bestsellers(8);
  }

  @Public()
  @Get("products/featured")
  async featured() {
    return this.catalogue.featured(8);
  }

  @Public()
  @Get("products/slug/:slug")
  async productBySlug(@Param("slug") slug: string) {
    return this.catalogue.getProductBySlug(slug, { onlyPublished: true });
  }

  @Public()
  @Get("products/slug/:slug/related")
  async related(@Param("slug") slug: string) {
    const product = await this.catalogue.getProductBySlug(slug, { onlyPublished: true });
    if (!product) return [];
    return this.catalogue.relatedProducts(product, 4);
  }
}

@ApiTags("admin-catalogue")
@Controller("admin/catalogue")
export class AdminCatalogueController {
  constructor(
    private readonly catalogue: CatalogueService,
    private readonly audit: AuditService,
  ) {}

  @Get("products")
  @Protected("products:read")
  @RequirePermissions("products:read")
  async listAll() {
    // Admin listing includes drafts; storefront only ever sees published.
    return this.catalogue.listProducts({
      search: undefined,
      sort: "newest",
      page: 1,
      pageSize: 48,
      includeUnavailable: true,
    });
  }

  @Get("products/:id")
  @Protected("products:read")
  @RequirePermissions("products:read")
  async getOne(@Param("id") id: string) {
    return this.catalogue.getProductById(id);
  }

  @Post("products")
  @Protected("products:write")
  @RequirePermissions("products:write")
  async create(
    @Body(new ZodValidationPipe(productUpsertSchema)) dto: ProductUpsertDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    const result = await this.catalogue.upsertProduct(dto);
    await this.audit.record({
      actor,
      action: "product.create",
      targetType: "product",
      targetId: result.id,
      summary: `Created product ${dto.sku} (${dto.name})`,
    });
    return result;
  }

  @Post("products/:id")
  @Protected("products:write")
  @RequirePermissions("products:write")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(productUpsertSchema)) dto: ProductUpsertDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    const result = await this.catalogue.upsertProduct(dto, id);
    await this.audit.record({
      actor,
      action: "product.update",
      targetType: "product",
      targetId: id,
      summary: `Updated product ${dto.sku} (${dto.name})`,
    });
    return result;
  }

  @Delete("products/:id")
  @Protected("products:write")
  @RequirePermissions("products:write")
  async archive(@Param("id") id: string, @CurrentUser() actor: AuthPrincipal) {
    await this.catalogue.archiveProduct(id);
    await this.audit.record({
      actor,
      action: "product.archive",
      targetType: "product",
      targetId: id,
      summary: `Archived product ${id}`,
    });
    return { archived: true };
  }

  @Post("categories")
  @Protected("categories:write")
  @RequirePermissions("categories:write")
  async createCategory(
    @Body(new ZodValidationPipe(categoryUpsertSchema)) dto: CategoryUpsertDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    const result = await this.catalogue.upsertCategory(dto);
    await this.audit.record({
      actor,
      action: "category.create",
      targetType: "category",
      targetId: result.id,
      summary: `Created category ${dto.slug}`,
    });
    return result;
  }

  @Post("categories/:id")
  @Protected("categories:write")
  @RequirePermissions("categories:write")
  async updateCategory(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(categoryUpsertSchema)) dto: CategoryUpsertDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    const result = await this.catalogue.upsertCategory(dto, id);
    await this.audit.record({
      actor,
      action: "category.update",
      targetType: "category",
      targetId: id,
      summary: `Updated category ${dto.slug}`,
    });
    return result;
  }

  @Get("categories")
  @Protected("categories:read")
  @RequirePermissions("categories:read")
  async allCategories() {
    return this.catalogue.listCategories(true);
  }
}
