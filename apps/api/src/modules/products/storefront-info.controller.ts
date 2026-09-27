import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Public endpoint — returns minimal storefront metadata (name + currency)
 * so client pages can display the correct currency symbol without a full
 * tenant auth context.  The tenant row itself is NOT behind RLS so we use
 * `prisma.base` directly.
 */
@ApiTags('Storefront')
@Controller('storefront/info')
export class StorefrontInfoController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async getInfo(@CurrentTenantId() tenantId: string | null) {
    if (!tenantId) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'No store resolved for this request.',
      });
    }
    const tenant = await this.prisma.base.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, currency: true, logoUrl: true, bannerUrl: true, primaryColor: true, tagline: true },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'No store found.',
      });
    }
    return {
      name: tenant.name,
      currency: tenant.currency.toUpperCase(),
      logoUrl: tenant.logoUrl,
      bannerUrl: tenant.bannerUrl,
      primaryColor: tenant.primaryColor,
      tagline: tenant.tagline,
    };
  }
}
