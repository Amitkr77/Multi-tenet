import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('connect/onboard')
  @RequirePermissions('billing.connect_payment_account')
  startOnboarding(@CurrentTenantId() tenantId: string) {
    return this.paymentsService.startOnboarding(tenantId);
  }

  @Get('connect/status')
  @RequirePermissions('billing.connect_payment_account')
  getStatus(@CurrentTenantId() tenantId: string) {
    return this.paymentsService.getAccount(tenantId);
  }

  @Get('payouts')
  @RequirePermissions('payments.view')
  listPayouts(@CurrentTenantId() tenantId: string) {
    return this.paymentsService.listPayouts(tenantId);
  }
}
