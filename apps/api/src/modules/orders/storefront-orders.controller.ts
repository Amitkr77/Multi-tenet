import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentCustomer,
  type AuthenticatedCustomer,
} from '../../common/decorators/current-customer.decorator';
import { CustomerJwtGuard } from '../../common/guards/customer-jwt.guard';
import { OrdersService } from './orders.service';

/**
 * Customer-facing own-order-history routes — see orders.controller.ts's
 * comment for why this is a separate controller/path rather than a
 * dual-mode `GET /orders/:id`. Lives in the orders module (not customers/)
 * since it's OrdersService's data; the literal path just happens to nest
 * under `/customers/me` — Nest routes by literal path, not by which module
 * declares the controller, so this is no different from any other module
 * boundary in this codebase.
 */
@ApiTags('Orders')
@Controller('customers/me/orders')
@Public()
@UseGuards(CustomerJwtGuard)
export class StorefrontOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.ordersService.listForCustomer(
      customer.tenantId,
      customer.customerId,
    );
  }

  @Get(':id')
  getOne(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id') id: string,
  ) {
    return this.ordersService.getOwnedByCustomer(
      customer.tenantId,
      customer.customerId,
      id,
    );
  }
}
