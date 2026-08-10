import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartService } from './cart.service';

const CART_INCLUDE = {
  items: { include: { variant: { include: { product: true } } } },
};

function makeCart(items: any[] = []): any {
  return { id: 'cart-1', tenantId: 't1', customerId: 'cust-1', items };
}

function makeVariant(id = 'var-1'): any {
  return { id, tenantId: 't1', sku: 'SKU-1', price: '9.99' };
}

function makeCartItem(id = 'item-1', variantId = 'var-1', quantity = 2): any {
  return { id, cartId: 'cart-1', variantId, quantity, tenantId: 't1' };
}

function makeService(
  opts: {
    variant?: any | null;
    cart?: any;
    cartItem?: any | null;
  } = {},
) {
  const variant = opts.variant !== undefined ? opts.variant : makeVariant();
  const cart = opts.cart ?? makeCart();
  const cartItem = opts.cartItem !== undefined ? opts.cartItem : makeCartItem();

  const prisma = {
    client: {
      productVariant: {
        findFirst: jest.fn().mockResolvedValue(variant),
      },
      cart: {
        findUnique: jest.fn().mockResolvedValue(cart),
        create: jest.fn().mockResolvedValue(makeCart()),
      },
      cartItem: {
        update: jest.fn().mockResolvedValue(cartItem),
        create: jest.fn().mockResolvedValue(cartItem),
        delete: jest.fn().mockResolvedValue(cartItem),
        findFirst: jest.fn().mockResolvedValue(cartItem),
      },
    },
  };

  return { service: new CartService(prisma as any), prisma };
}

// ─── getOrCreateCart ──────────────────────────────────────────────────────────

describe('CartService#getOrCreateCart', () => {
  it('returns existing cart when one is found', async () => {
    const cart = makeCart();
    const { service, prisma } = makeService({ cart });
    const result = await service.getOrCreateCart('t1', 'cust-1');
    expect(result).toEqual(cart);
    expect(prisma.client.cart.create).not.toHaveBeenCalled();
  });

  it('creates and returns a new cart when none exists', async () => {
    const { service, prisma } = makeService();
    // First call (getOrCreateCart inside addItem) — return null, then the new cart
    prisma.client.cart.findUnique.mockResolvedValueOnce(null);
    const result = await service.getOrCreateCart('t1', 'cust-1');
    expect(prisma.client.cart.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tenantId: 't1', customerId: 'cust-1' } }),
    );
    expect(result).toEqual(makeCart());
  });
});

// ─── addItem ──────────────────────────────────────────────────────────────────

describe('CartService#addItem', () => {
  it('throws NotFoundException when the variant does not exist', async () => {
    const { service } = makeService({ variant: null });
    await expect(
      service.addItem('t1', 'cust-1', { variantId: 'var-1', quantity: 1 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('creates a new cart item when the variant is not already in the cart', async () => {
    const cart = makeCart([]); // empty cart — no existing item
    const { service, prisma } = makeService({ cart });
    // Second call (refreshing cart after mutation) returns same cart
    prisma.client.cart.findUnique.mockResolvedValue(cart);
    await service.addItem('t1', 'cust-1', { variantId: 'var-1', quantity: 2 });
    expect(prisma.client.cartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ variantId: 'var-1', quantity: 2 }),
      }),
    );
    expect(prisma.client.cartItem.update).not.toHaveBeenCalled();
  });

  it('increments quantity when the variant is already in the cart', async () => {
    const existingItem = makeCartItem('item-1', 'var-1', 3);
    const cart = makeCart([existingItem]);
    const { service, prisma } = makeService({ cart });
    prisma.client.cart.findUnique.mockResolvedValue(cart);
    await service.addItem('t1', 'cust-1', { variantId: 'var-1', quantity: 2 });
    expect(prisma.client.cartItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { quantity: 5 }, // 3 + 2
    });
    expect(prisma.client.cartItem.create).not.toHaveBeenCalled();
  });
});

// ─── updateItem ───────────────────────────────────────────────────────────────

describe('CartService#updateItem', () => {
  it('throws NotFoundException when the cart item does not belong to this customer', async () => {
    const { service, prisma } = makeService({ cartItem: null });
    prisma.client.cartItem.findFirst.mockResolvedValue(null);
    await expect(
      service.updateItem('t1', 'cust-1', 'item-99', { quantity: 1 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates the quantity for a valid owned item', async () => {
    const item = makeCartItem();
    const cart = makeCart([item]);
    const { service, prisma } = makeService({ cartItem: item, cart });
    await service.updateItem('t1', 'cust-1', 'item-1', { quantity: 5 });
    expect(prisma.client.cartItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { quantity: 5 },
    });
  });
});

// ─── removeItem ───────────────────────────────────────────────────────────────

describe('CartService#removeItem', () => {
  it('throws NotFoundException when item is not found or does not belong to customer', async () => {
    const { service, prisma } = makeService();
    prisma.client.cartItem.findFirst.mockResolvedValue(null);
    await expect(
      service.removeItem('t1', 'cust-1', 'item-99'),
    ).rejects.toThrow(NotFoundException);
  });

  it('deletes the item when it exists and belongs to the customer', async () => {
    const item = makeCartItem();
    const { service, prisma } = makeService({ cartItem: item });
    await service.removeItem('t1', 'cust-1', 'item-1');
    expect(prisma.client.cartItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
  });
});

// ─── requireNonEmptyCart ──────────────────────────────────────────────────────

describe('CartService#requireNonEmptyCart', () => {
  it('throws BadRequestException when the cart is empty', async () => {
    const { service } = makeService({ cart: makeCart([]) });
    await expect(
      service.requireNonEmptyCart('t1', 'cust-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns the cart when it has at least one item', async () => {
    const cart = makeCart([makeCartItem()]);
    const { service } = makeService({ cart });
    await expect(service.requireNonEmptyCart('t1', 'cust-1')).resolves.toEqual(cart);
  });
});
