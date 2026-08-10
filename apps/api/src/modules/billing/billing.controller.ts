import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { upgradePlanSchema } from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plan')
  @RequirePermissions('billing.view')
  getPlan(@CurrentTenantId() tenantId: string) {
    return this.billingService.getCurrentPlanAndUsage(tenantId);
  }

  @ZodBody(upgradePlanSchema)
  @Post('upgrade')
  @RequirePermissions('billing.change_plan')
  upgrade(
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(upgradePlanSchema)) dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billingService.upgrade(tenantId, dto, user.userId);
  }

  @Get('invoices')
  @RequirePermissions('billing.view_invoices')
  invoices(@CurrentTenantId() tenantId: string) {
    return this.billingService.listInvoices(tenantId);
  }
}
