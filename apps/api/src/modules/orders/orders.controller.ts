import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { updateOrderStatusSchema, refundOrderSchema } from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { OrdersService } from './orders.service';

/**
 * Staff-facing only. `GET /orders/:id`'s literal spec entry is dual-mode
 * ("Staff+ / customer, own only") — same guard-chain conflict Products hit
 * (`@Public()` fully skips JWT, can't cleanly co-exist with a differently-
 * scoped guard on the same path). Resolved the same way: the customer-facing
 * equivalent lives at `GET /customers/me/orders/:id` instead (see
 * storefront-orders.controller.ts) — a disclosed, deliberate deviation from
 * the literal spec, same reasoning as the `/storefront/products` split.
 */
@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions('orders.view')
  list(
    @CurrentTenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.ordersService.list(tenantId, { status, search });
  }

  @Get(':id')
  @RequirePermissions('orders.view')
  getOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.ordersService.getById(tenantId, id);
  }

  @ZodBody(updateOrderStatusSchema)
  @Patch(':id/status')
  @RequirePermissions('orders.update_status')
  updateStatus(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateOrderStatusSchema)) dto: any,
  ) {
    return this.ordersService.updateStatus(tenantId, id, dto);
  }

  @ZodBody(refundOrderSchema)
  @Post(':id/refund')
  @RequirePermissions('orders.refund')
  refund(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(refundOrderSchema)) dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.refund(tenantId, id, dto, user.userId);
  }
}
