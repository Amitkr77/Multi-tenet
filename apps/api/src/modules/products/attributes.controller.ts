import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createAttributeSchema } from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { AttributesService } from './attributes.service';

@ApiTags('Products')
@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Get()
  @RequirePermissions('products.view')
  list(@CurrentTenantId() tenantId: string) {
    return this.attributesService.list(tenantId);
  }

  @ZodBody(createAttributeSchema)
  @Post()
  @RequirePermissions('products.manage')
  create(
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(createAttributeSchema)) dto: any,
  ) {
    return this.attributesService.create(tenantId, dto);
  }
}
