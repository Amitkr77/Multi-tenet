import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { updateCustomerSchema } from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { CustomersService } from './customers.service';

/**
 * Tenant-facing (staff) customer management. Registered AFTER
 * CustomerAuthController in customers.module.ts — its literal paths
 * (register/login/refresh/logout/me) are the same one-segment depth as this
 * controller's `:id`, so registration order decides which wins (same
 * ordering discipline as tenants.module.ts's /me-vs-/:id note in Phase 1).
 */
@ApiTags('Customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions('customers.view')
  list(@CurrentTenantId() tenantId: string, @Query('search') search?: string) {
    return this.customersService.list(tenantId, search);
  }

  @Get(':id')
  @RequirePermissions('customers.view')
  getOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.customersService.getById(tenantId, id);
  }

  @ZodBody(updateCustomerSchema)
  @Patch(':id')
  @RequirePermissions('customers.manage')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) dto: any,
  ) {
    return this.customersService.update(tenantId, id, dto);
  }
}
