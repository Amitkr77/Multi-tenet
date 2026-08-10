import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createBrandSchema, updateBrandSchema } from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { BrandsService } from './brands.service';

@ApiTags('Products')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @RequirePermissions('products.view')
  list(@CurrentTenantId() tenantId: string) {
    return this.brandsService.list(tenantId);
  }

  @ZodBody(createBrandSchema)
  @Post()
  @RequirePermissions('products.manage')
  create(
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(createBrandSchema)) dto: any,
  ) {
    return this.brandsService.create(tenantId, dto);
  }

  @ZodBody(updateBrandSchema)
  @Patch(':id')
  @RequirePermissions('products.manage')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBrandSchema)) dto: any,
  ) {
    return this.brandsService.update(tenantId, id, dto);
  }
}
