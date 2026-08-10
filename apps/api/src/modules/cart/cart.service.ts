import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AddCartItemDto, UpdateCartItemDto } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const CART_INCLUDE = {
  items: {
    include: {
      variant: { include: { product: true } },
    },
  },
};

/**
 * Storefront-only, `@UseGuards(CustomerJwtGuard)` on every route (see
 * cart.controller.ts). Every query is scoped by BOTH tenantId (the usual
 * RLS-backed isolation, via `this.prisma.client`) AND customerId — RLS
 * only separates tenants from each other, not customer A from customer B
 * within the same tenant, so every method here also filters/joins on
 * `cart.customerId` explicitly.
 */
@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateCart(tenantId: string, customerId: string): Promise<any> {
    const existing = await this.prisma.client.cart.findUnique({
      where: { tenantId_customerId: { tenantId, customerId } },
      include: CART_INCLUDE,
    });
    if (existing) return existing;
    return this.prisma.client.cart.create({
      data: { tenantId, customerId },
      include: CART_INCLUDE,
    });
  }

  async addItem(
    tenantId: string,
    customerId: string,
    dto: AddCartItemDto,
  ): Promise<any> {
    const variant = await this.prisma.client.productVariant.findFirst({
      where: { id: dto.variantId, tenantId },
    });
    if (!variant)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Product variant not found.',
      });

    const cart = await this.getOrCreateCart(tenantId, customerId);
    const existingItem = cart.items.find(
      (i: any) => i.variantId === dto.variantId,
    );
    if (existingItem) {
      await this.prisma.client.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + dto.quantity },
      });
    } else {
      await this.prisma.client.cartItem.create({
        data: {
          cartId: cart.id,
          tenantId,
          variantId: dto.variantId,
          quantity: dto.quantity,
        },
      });
    }
    return this.getOrCreateCart(tenantId, customerId);
  }

  async updateItem(
    tenantId: string,
    customerId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<any> {
    await this.getOwnedItemOr404(tenantId, customerId, itemId);
    await this.prisma.client.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });
    return this.getOrCreateCart(tenantId, customerId);
  }

  async removeItem(
    tenantId: string,
    customerId: string,
    itemId: string,
  ): Promise<any> {
    await this.getOwnedItemOr404(tenantId, customerId, itemId);
    await this.prisma.client.cartItem.delete({ where: { id: itemId } });
    return this.getOrCreateCart(tenantId, customerId);
  }

  private async getOwnedItemOr404(
    tenantId: string,
    customerId: string,
    itemId: string,
  ): Promise<any> {
    const item = await this.prisma.client.cartItem.findFirst({
      where: { id: itemId, tenantId, cart: { customerId } },
    });
    if (!item)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Cart item not found.',
      });
    return item;
  }

  /** Throws if the cart is empty — used by CheckoutService (M19) before quoting/completing. */
  async requireNonEmptyCart(
    tenantId: string,
    customerId: string,
  ): Promise<any> {
    const cart = await this.getOrCreateCart(tenantId, customerId);
    if (cart.items.length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Your cart is empty.',
      });
    }
    return cart;
  }
}
