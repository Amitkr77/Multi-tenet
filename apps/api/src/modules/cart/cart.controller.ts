import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { addCartItemSchema, updateCartItemSchema } from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentCustomer,
  type AuthenticatedCustomer,
} from '../../common/decorators/current-customer.decorator';
import { CustomerJwtGuard } from '../../common/guards/customer-jwt.guard';
import { CartService } from './cart.service';

/**
 * Storefront-only — every route is `@Public()` (opts out of the global
 * staff JwtAuthGuard) + `@UseGuards(CustomerJwtGuard)` (enforces customer
 * auth in its place), same composition as customer-auth.controller.ts's
 * `me`/`me/addresses` routes.
 */
@ApiTags('Cart')
@Controller('cart')
@Public()
@UseGuards(CustomerJwtGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.cartService.getOrCreateCart(
      customer.tenantId,
      customer.customerId,
    );
  }

  @ZodBody(addCartItemSchema)
  @Post('items')
  addItem(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body(new ZodValidationPipe(addCartItemSchema)) dto: any,
  ) {
    return this.cartService.addItem(
      customer.tenantId,
      customer.customerId,
      dto,
    );
  }

  @ZodBody(updateCartItemSchema)
  @Patch('items/:id')
  updateItem(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id') itemId: string,
    @Body(new ZodValidationPipe(updateCartItemSchema)) dto: any,
  ) {
    return this.cartService.updateItem(
      customer.tenantId,
      customer.customerId,
      itemId,
      dto,
    );
  }

  @Delete('items/:id')
  removeItem(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id') itemId: string,
  ) {
    return this.cartService.removeItem(
      customer.tenantId,
      customer.customerId,
      itemId,
    );
  }
}
