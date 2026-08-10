import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { ProductsService } from './products.service';

/**
 * Public, published-only browsing — see products.service.ts's comment on
 * why this is a separate namespace rather than a dual-mode `/products`.
 * `tenantId` here comes purely from TenantResolverGuard's Host-header (or
 * `X-Tenant-Subdomain` dev header) resolution — no JWT involved at all.
 */
@ApiTags('Storefront')
@Controller('storefront/products')
export class StorefrontProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  list(
    @CurrentTenantId() tenantId: string | null,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.requireTenant(tenantId);
    return this.productsService.listPublic(tenantId!, {
      categoryId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Public()
  @Get(':slug')
  getOne(
    @CurrentTenantId() tenantId: string | null,
    @Param('slug') slug: string,
  ) {
    this.requireTenant(tenantId);
    return this.productsService.getPublicBySlug(tenantId!, slug);
  }

  private requireTenant(tenantId: string | null): void {
    if (!tenantId) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'No store resolved for this request.',
      });
    }
  }
}
