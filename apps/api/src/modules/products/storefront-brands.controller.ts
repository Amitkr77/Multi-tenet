import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { BrandsService } from './brands.service';

@ApiTags('Storefront')
@Controller('storefront/brands')
export class StorefrontBrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Public()
  @Get()
  list(@CurrentTenantId() tenantId: string | null) {
    if (!tenantId) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'No store resolved for this request.',
      });
    }
    return this.brandsService.listPublic(tenantId);
  }
}
