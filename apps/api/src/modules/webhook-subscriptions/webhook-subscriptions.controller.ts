import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createWebhookSubscriptionSchema,
  updateWebhookSubscriptionSchema,
} from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { WebhookSubscriptionsService } from './webhook-subscriptions.service';

@ApiTags('Webhook Subscriptions')
@Controller('webhook-subscriptions')
@RequirePermissions('webhooks.manage')
export class WebhookSubscriptionsController {
  constructor(private readonly service: WebhookSubscriptionsService) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.service.list(tenantId);
  }

  @ZodBody(createWebhookSubscriptionSchema)
  @Post()
  create(
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(createWebhookSubscriptionSchema)) dto: any,
  ) {
    return this.service.create(tenantId, dto);
  }

  @ZodBody(updateWebhookSubscriptionSchema)
  @Patch(':id')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWebhookSubscriptionSchema)) dto: any,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    await this.service.remove(tenantId, id);
  }

  @Get(':id/deliveries')
  listDeliveries(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.service.listDeliveries(tenantId, id);
  }
}
