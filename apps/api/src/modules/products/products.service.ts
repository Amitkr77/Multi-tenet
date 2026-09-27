import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import type {
  CreateProductDto,
  UpdateProductDto,
  CreateVariantDto,
  UpdateVariantDto,
  SetAttributeValueDto,
  PresignImageDto,
  ConfirmImageDto,
  ProductCsvImportResult,
} from '@saas/shared-types';
import { productCsvRowSchema } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { WebhookDispatchService } from '../webhook-subscriptions/webhook-dispatch.service';

const MAX_CSV_ROWS = 5000;

// files/10-performance-load-test.md — GET /products (and its storefront
// counterpart) had no pagination at all: every product for the tenant,
// eager-loading category/brand/images/variants+inventory/attributeValues,
// in one response. Measured directly: a single request against a
// realistic-but-not-extreme 2000-product catalog returned a 4.5MB payload
// and took ~700ms even unloaded, ~3.5-5s p50/p95 under 20 concurrent
// requests — many times over NFR-PF-02's 300ms read target. The base query
// itself was never the problem (EXPLAIN ANALYZE: 5.9ms, correctly using
// the tenant_id-led index) — an unbounded result set fanned out across five
// eager-loaded relations was. DEFAULT_PAGE_SIZE keeps the response a bare
// array (unchanged shape — no existing caller, test, or frontend page reads
// a `{data, meta}` envelope) so this is a non-breaking, load-bearing default,
// not an opt-in. 100/page still measured p95 ~355-385ms under 20 concurrent
// requests — better, but still over target; 50/page measured p95 ~62ms,
// comfortably clear of it, so 50 is the default, not 100.
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function resolvePagination(page?: number, limit?: number) {
  const safePage = page && page > 0 ? Math.floor(page) : 1;
  const safeLimit =
    limit && limit > 0
      ? Math.min(Math.floor(limit), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  return { skip: (safePage - 1) * safeLimit, take: safeLimit };
}

const PRODUCT_INCLUDE = {
  category: true,
  brand: true,
  images: { orderBy: { position: 'asc' as const } },
  variants: { include: { inventory: true } },
  attributeValues: { include: { attribute: true } },
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly webhookDispatch: WebhookDispatchService,
  ) {}

  // -------------------------------------------------------------------
  // Tenant-facing (staff) CRUD
  // -------------------------------------------------------------------

  async list(
    tenantId: string,
    filters: {
      categoryId?: string;
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<any> {
    return this.prisma.client.product.findMany({
      where: {
        tenantId,
        categoryId: filters.categoryId,
        status: filters.status as any,
        name: filters.search
          ? { contains: filters.search, mode: 'insensitive' }
          : undefined,
      },
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      ...resolvePagination(filters.page, filters.limit),
    });
  }

  async getById(tenantId: string, id: string): Promise<any> {
    const product = await this.prisma.client.product.findFirst({
      where: { id, tenantId },
      include: PRODUCT_INCLUDE,
    });
    if (!product)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Product not found.',
      });
    return product;
  }

  // -------------------------------------------------------------------
  // Storefront-facing (public, published-only)
  //
  // 06-api-specification.md lists `/products` itself as "Bearer / Public"
  // dual-mode — reachable either authenticated (sees all statuses) or
  // anonymous (published-only). `@Public()` in this codebase's guard chain
  // skips JWT verification entirely rather than optionally attempting it, so
  // one route can't cleanly serve both audiences with different guards.
  // Deliberate, disclosed deviation: a separate `/storefront/products`
  // namespace (see storefront-products.controller.ts) — always public,
  // always published-only — mirrors the frontend's own separate
  // `(storefront)` route group rather than forcing a hybrid optional-auth
  // guard onto the staff-facing endpoints.
  // -------------------------------------------------------------------

  async listPublic(
    tenantId: string,
    filters: {
      categoryId?: string;
      brandId?: string;
      search?: string;
      sort?: string;
      minPrice?: number;
      maxPrice?: number;
      page?: number;
      limit?: number;
    },
  ): Promise<any> {
    let orderBy: any = { createdAt: 'desc' };
    switch (filters.sort) {
      case 'price_asc': orderBy = { basePrice: 'asc' }; break;
      case 'price_desc': orderBy = { basePrice: 'desc' }; break;
      case 'name_asc': orderBy = { name: 'asc' }; break;
    }

    const priceFilter: any = {};
    if (filters.minPrice !== undefined) priceFilter.gte = filters.minPrice;
    if (filters.maxPrice !== undefined) priceFilter.lte = filters.maxPrice;

    return this.prisma.client.product.findMany({
      where: {
        tenantId,
        status: 'published',
        categoryId: filters.categoryId,
        brandId: filters.brandId,
        name: filters.search
          ? { contains: filters.search, mode: 'insensitive' }
          : undefined,
        basePrice: Object.keys(priceFilter).length ? priceFilter : undefined,
      },
      include: PRODUCT_INCLUDE,
      orderBy,
      ...resolvePagination(filters.page, filters.limit),
    });
  }

  async getPublicBySlug(tenantId: string, slug: string): Promise<any> {
    const product = await this.prisma.client.product.findFirst({
      where: { tenantId, slug, status: 'published' },
      include: PRODUCT_INCLUDE,
    });
    if (!product)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Product not found.',
      });
    return product;
  }

  private async getDefaultWarehouse(tenantId: string): Promise<any> {
    const warehouse = await this.prisma.client.warehouse.findFirst({
      where: { tenantId, isDefault: true },
    });
    if (!warehouse)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No default warehouse configured for this tenant.',
      });
    return warehouse;
  }

  async create(tenantId: string, dto: CreateProductDto): Promise<any> {
    const existingSlug = await this.prisma.client.product.findUnique({
      where: { tenantId_slug: { tenantId, slug: dto.slug } },
    });
    if (existingSlug)
      throw new BadRequestException({
        code: 'CONFLICT',
        message: 'A product with this slug already exists.',
      });

    const { variant, ...productFields } = dto;
    const product = await this.prisma.client.product.create({
      data: { tenantId, ...productFields },
    });

    if (variant) {
      await this.createVariantWithInventory(tenantId, product.id, variant);
    }

    const created = await this.getById(tenantId, product.id);
    await this.webhookDispatch.dispatch(tenantId, 'product.created', {
      productId: created.id,
      name: created.name,
      slug: created.slug,
      status: created.status,
    });
    return created;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<any> {
    await this.getById(tenantId, id); // 404 if missing
    if (dto.slug) {
      const clash = await this.prisma.client.product.findFirst({
        where: { tenantId, slug: dto.slug, NOT: { id } },
      });
      if (clash)
        throw new BadRequestException({
          code: 'CONFLICT',
          message: 'A product with this slug already exists.',
        });
    }
    await this.prisma.client.product.update({ where: { id }, data: dto });
    const updated = await this.getById(tenantId, id);
    await this.webhookDispatch.dispatch(tenantId, 'product.updated', {
      productId: updated.id,
      name: updated.name,
      slug: updated.slug,
      status: updated.status,
    });
    return updated;
  }

  async remove(tenantId: string, id: string) {
    const product = await this.getById(tenantId, id);
    // Best-effort storage cleanup — a failed delete here shouldn't block
    // removing the catalog row; orphaned objects are a cheap cost to accept
    // for Phase 2 rather than building a reconciliation job for it.
    for (const image of product.images) {
      await this.storage.deleteObject(image.key).catch(() => undefined);
    }
    await this.prisma.client.product.delete({ where: { id } });
    await this.webhookDispatch.dispatch(tenantId, 'product.deleted', {
      productId: id,
      slug: product.slug,
    });
  }

  // -------------------------------------------------------------------
  // Variants
  // -------------------------------------------------------------------

  private async createVariantWithInventory(
    tenantId: string,
    productId: string,
    dto: CreateVariantDto,
  ): Promise<any> {
    const existingSku = await this.prisma.client.productVariant.findUnique({
      where: { tenantId_sku: { tenantId, sku: dto.sku } },
    });
    if (existingSku)
      throw new BadRequestException({
        code: 'CONFLICT',
        message: `SKU "${dto.sku}" is already in use.`,
      });

    const warehouse = await this.getDefaultWarehouse(tenantId);
    const variant = await this.prisma.client.productVariant.create({
      data: {
        tenantId,
        productId,
        sku: dto.sku,
        price: dto.price,
        options: dto.options ?? {},
      },
    });
    const inventory = await this.prisma.client.inventory.create({
      data: {
        tenantId,
        variantId: variant.id,
        warehouseId: warehouse.id,
        quantityOnHand: dto.initialStock ?? 0,
      },
    });
    if ((dto.initialStock ?? 0) > 0) {
      await this.prisma.client.inventoryAdjustment.create({
        data: {
          tenantId,
          inventoryId: inventory.id,
          delta: dto.initialStock,
          reasonCode: 'initial_stock',
        },
      });
    }
    return variant;
  }

  async addVariant(
    tenantId: string,
    productId: string,
    dto: CreateVariantDto,
  ): Promise<any> {
    await this.getById(tenantId, productId);
    await this.createVariantWithInventory(tenantId, productId, dto);
    return this.getById(tenantId, productId);
  }

  async updateVariant(
    tenantId: string,
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
  ): Promise<any> {
    const variant = await this.prisma.client.productVariant.findFirst({
      where: { id: variantId, productId, tenantId },
    });
    if (!variant)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Variant not found.',
      });
    if (dto.sku) {
      const clash = await this.prisma.client.productVariant.findFirst({
        where: { tenantId, sku: dto.sku, NOT: { id: variantId } },
      });
      if (clash)
        throw new BadRequestException({
          code: 'CONFLICT',
          message: `SKU "${dto.sku}" is already in use.`,
        });
    }
    await this.prisma.client.productVariant.update({
      where: { id: variantId },
      data: dto,
    });
    return this.getById(tenantId, productId);
  }

  // -------------------------------------------------------------------
  // Attribute values
  // -------------------------------------------------------------------

  async setAttributeValue(
    tenantId: string,
    productId: string,
    dto: SetAttributeValueDto,
  ): Promise<any> {
    await this.getById(tenantId, productId);
    const attribute = await this.prisma.client.productAttribute.findFirst({
      where: { id: dto.attributeId, tenantId },
    });
    if (!attribute)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Attribute not found.',
      });

    const existing = await this.prisma.client.productAttributeValue.findFirst({
      where: { productId, attributeId: dto.attributeId },
    });
    if (existing) {
      await this.prisma.client.productAttributeValue.update({
        where: { id: existing.id },
        data: { value: dto.value },
      });
    } else {
      await this.prisma.client.productAttributeValue.create({
        data: {
          tenantId,
          productId,
          attributeId: dto.attributeId,
          value: dto.value,
        },
      });
    }
    return this.getById(tenantId, productId);
  }

  // -------------------------------------------------------------------
  // Images
  // -------------------------------------------------------------------

  async presignImage(
    tenantId: string,
    productId: string,
    dto: PresignImageDto,
  ) {
    await this.getById(tenantId, productId);
    const key = this.storage.buildKey(tenantId, productId, dto.filename);
    const uploadUrl = await this.storage.getPresignedUploadUrl(
      key,
      dto.contentType,
    );
    return { uploadUrl, publicUrl: this.storage.getPublicUrl(key), key };
  }

  async confirmImage(
    tenantId: string,
    productId: string,
    dto: ConfirmImageDto,
  ): Promise<any> {
    await this.getById(tenantId, productId);
    const position = await this.prisma.client.productImage.count({
      where: { productId },
    });
    await this.prisma.client.productImage.create({
      data: {
        tenantId,
        productId,
        key: dto.key,
        url: this.storage.getPublicUrl(dto.key),
        position,
      },
    });
    return this.getById(tenantId, productId);
  }

  async removeImage(
    tenantId: string,
    productId: string,
    imageId: string,
  ): Promise<any> {
    const image = await this.prisma.client.productImage.findFirst({
      where: { id: imageId, productId, tenantId },
    });
    if (!image)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Image not found.',
      });
    await this.storage.deleteObject(image.key).catch(() => undefined);
    await this.prisma.client.productImage.delete({ where: { id: imageId } });
    return this.getById(tenantId, productId);
  }

  // -------------------------------------------------------------------
  // Bulk CSV import/export (FR-PR-07)
  // -------------------------------------------------------------------

  async bulkImport(
    tenantId: string,
    csvText: string,
  ): Promise<ProductCsvImportResult> {
    const rawRows: unknown[] = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    if (rawRows.length > MAX_CSV_ROWS) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `CSV exceeds the ${MAX_CSV_ROWS}-row import limit.`,
      });
    }

    const result: ProductCsvImportResult = {
      totalRows: rawRows.length,
      succeeded: 0,
      failed: [],
    };
    const warehouse = await this.getDefaultWarehouse(tenantId);

    for (const [index, raw] of rawRows.entries()) {
      const rowNumber = index + 2; // +1 for 0-index, +1 for the header row
      try {
        const row = productCsvRowSchema.parse(raw);

        let categoryId: string | undefined;
        if (row.categorySlug) {
          const category = await this.prisma.client.category.upsert({
            where: { tenantId_slug: { tenantId, slug: row.categorySlug } },
            update: {},
            create: {
              tenantId,
              slug: row.categorySlug,
              name: row.categorySlug,
            },
          });
          categoryId = category.id;
        }

        let brandId: string | undefined;
        if (row.brandSlug) {
          const brand = await this.prisma.client.brand.upsert({
            where: { tenantId_slug: { tenantId, slug: row.brandSlug } },
            update: {},
            create: { tenantId, slug: row.brandSlug, name: row.brandSlug },
          });
          brandId = brand.id;
        }

        const existingProduct = await this.prisma.client.product.findUnique({
          where: { tenantId_slug: { tenantId, slug: row.slug } },
        });
        if (existingProduct)
          throw new Error(`Product slug "${row.slug}" already exists`);
        const existingSku = await this.prisma.client.productVariant.findUnique({
          where: { tenantId_sku: { tenantId, sku: row.sku } },
        });
        if (existingSku) throw new Error(`SKU "${row.sku}" already exists`);

        const product = await this.prisma.client.product.create({
          data: {
            tenantId,
            name: row.name,
            slug: row.slug,
            description: row.description,
            basePrice: row.basePrice,
            categoryId,
            brandId,
            status: 'draft',
          },
        });
        const variant = await this.prisma.client.productVariant.create({
          data: { tenantId, productId: product.id, sku: row.sku, options: {} },
        });
        const inventory = await this.prisma.client.inventory.create({
          data: {
            tenantId,
            variantId: variant.id,
            warehouseId: warehouse.id,
            quantityOnHand: row.initialStock,
          },
        });
        if (row.initialStock > 0) {
          await this.prisma.client.inventoryAdjustment.create({
            data: {
              tenantId,
              inventoryId: inventory.id,
              delta: row.initialStock,
              reasonCode: 'initial_stock',
            },
          });
        }

        result.succeeded++;
      } catch (err) {
        result.failed.push({
          row: rowNumber,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  async bulkExport(tenantId: string): Promise<string> {
    const products = await this.prisma.client.product.findMany({
      where: { tenantId },
      include: {
        category: true,
        brand: true,
        variants: { include: { inventory: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const rows = products.flatMap((p: any) =>
      (p.variants.length ? p.variants : [null]).map((v: any) => ({
        name: p.name,
        slug: p.slug,
        categorySlug: p.category?.slug ?? '',
        brandSlug: p.brand?.slug ?? '',
        basePrice: p.basePrice.toString(),
        description: p.description ?? '',
        sku: v?.sku ?? '',
        initialStock: v?.inventory?.[0]?.quantityOnHand ?? 0,
      })),
    );

    return stringify(rows, { header: true });
  }
}
