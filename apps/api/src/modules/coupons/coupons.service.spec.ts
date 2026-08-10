import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CouponsService } from './coupons.service';

function makeCoupon(overrides: Record<string, any> = {}): any {
  return {
    id: 'cpn-1',
    code: 'SAVE10',
    type: 'percentage',
    value: '10',
    isActive: true,
    expiresAt: null,
    usageLimit: null,
    usedCount: 0,
    minOrderValue: null,
    perCustomerLimit: null,
    restrictedProductIds: [],
    restrictedCategoryIds: [],
    ...overrides,
  };
}

function makeService(
  coupon: any | null = makeCoupon(),
  redemptionCount = 0,
) {
  const prisma = {
    client: {
      coupon: {
        findMany: jest.fn().mockResolvedValue(coupon ? [coupon] : []),
        findUnique: jest.fn().mockResolvedValue(coupon),
        findFirst: jest.fn().mockResolvedValue(coupon),
        create: jest.fn().mockResolvedValue(coupon),
        update: jest.fn().mockResolvedValue(coupon),
        delete: jest.fn().mockResolvedValue(coupon),
      },
      couponRedemption: {
        count: jest.fn().mockResolvedValue(redemptionCount),
      },
    },
  };
  return { service: new CouponsService(prisma as any), prisma };
}

// ─── validatePreview ─────────────────────────────────────────────────────────

describe('CouponsService#validatePreview', () => {
  it('returns valid + discountAmount for an active percentage coupon', async () => {
    const { service } = makeService(makeCoupon({ type: 'percentage', value: '10' }));
    const result = await service.validatePreview('t1', 'SAVE10', 100);
    expect(result).toEqual({ valid: true, discountAmount: 10 });
  });

  it('returns valid + discountAmount for a flat coupon', async () => {
    const { service } = makeService(makeCoupon({ type: 'flat', value: '5' }));
    const result = await service.validatePreview('t1', 'FLAT5', 100);
    expect(result).toEqual({ valid: true, discountAmount: 5 });
  });

  it('caps flat discount at the subtotal', async () => {
    const { service } = makeService(makeCoupon({ type: 'flat', value: '200' }));
    const result = await service.validatePreview('t1', 'FLAT200', 50);
    expect(result).toEqual({ valid: true, discountAmount: 50 });
  });

  it('returns invalid when coupon is not found', async () => {
    const { service } = makeService(null);
    const result = await service.validatePreview('t1', 'NOPE', 100);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not found/i);
  });

  it('returns invalid when coupon is inactive', async () => {
    const { service } = makeService(makeCoupon({ isActive: false }));
    const result = await service.validatePreview('t1', 'SAVE10', 100);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no longer active/i);
  });

  it('returns invalid when coupon has expired', async () => {
    const { service } = makeService(
      makeCoupon({ expiresAt: new Date(Date.now() - 86400_000) }),
    );
    const result = await service.validatePreview('t1', 'SAVE10', 100);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expired/i);
  });

  it('returns invalid when usage limit is reached', async () => {
    const { service } = makeService(makeCoupon({ usageLimit: 10, usedCount: 10 }));
    const result = await service.validatePreview('t1', 'SAVE10', 100);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/usage limit/i);
  });

  it('returns invalid when subtotal is below minOrderValue', async () => {
    const { service } = makeService(makeCoupon({ minOrderValue: '50' }));
    const result = await service.validatePreview('t1', 'SAVE10', 30);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/minimum order/i);
  });

  it('returns valid when subtotal exactly meets minOrderValue', async () => {
    const { service } = makeService(makeCoupon({ minOrderValue: '50' }));
    const result = await service.validatePreview('t1', 'SAVE10', 50);
    expect(result.valid).toBe(true);
  });
});

// ─── resolveForCheckout ───────────────────────────────────────────────────────

describe('CouponsService#resolveForCheckout', () => {
  it('returns couponId + discountAmount for a valid percentage coupon', async () => {
    const { service } = makeService(makeCoupon({ type: 'percentage', value: '20' }));
    const result = await service.resolveForCheckout('t1', 'SAVE20', 'cust-1', 100, [], []);
    expect(result).toEqual({ couponId: 'cpn-1', discountAmount: 20 });
  });

  it('throws when coupon is not found', async () => {
    const { service } = makeService(null);
    await expect(
      service.resolveForCheckout('t1', 'NOPE', 'cust-1', 100, [], []),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when basic eligibility fails (inactive coupon)', async () => {
    const { service } = makeService(makeCoupon({ isActive: false }));
    await expect(
      service.resolveForCheckout('t1', 'SAVE10', 'cust-1', 100, [], []),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when cart contains a product outside the restricted list', async () => {
    const { service } = makeService(
      makeCoupon({ restrictedProductIds: ['prod-A'] }),
    );
    await expect(
      service.resolveForCheckout('t1', 'SAVE10', 'cust-1', 100, ['prod-A', 'prod-B'], []),
    ).rejects.toThrow(BadRequestException);
  });

  it('passes when all cart products are within the restricted list', async () => {
    const { service } = makeService(
      makeCoupon({ restrictedProductIds: ['prod-A', 'prod-B'] }),
    );
    await expect(
      service.resolveForCheckout('t1', 'SAVE10', 'cust-1', 100, ['prod-A'], []),
    ).resolves.toBeDefined();
  });

  it('throws when cart contains a category outside the restricted list', async () => {
    const { service } = makeService(
      makeCoupon({ restrictedCategoryIds: ['cat-X'] }),
    );
    await expect(
      service.resolveForCheckout('t1', 'SAVE10', 'cust-1', 100, [], ['cat-X', 'cat-Y']),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when customer has already used the coupon perCustomerLimit times', async () => {
    const { service } = makeService(makeCoupon({ perCustomerLimit: 1 }), 1);
    await expect(
      service.resolveForCheckout('t1', 'SAVE10', 'cust-1', 100, [], []),
    ).rejects.toThrow(BadRequestException);
  });

  it('passes when customer redemption count is below perCustomerLimit', async () => {
    const { service } = makeService(makeCoupon({ perCustomerLimit: 3 }), 2);
    await expect(
      service.resolveForCheckout('t1', 'SAVE10', 'cust-1', 100, [], []),
    ).resolves.toBeDefined();
  });
});

// ─── create / update / remove ─────────────────────────────────────────────────

describe('CouponsService#create', () => {
  it('throws when a coupon with the same code already exists', async () => {
    const { service } = makeService(); // findUnique returns existing coupon
    await expect(
      service.create('t1', { code: 'SAVE10', type: 'percentage', value: 10 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates and returns the coupon when the code is unique', async () => {
    const { service, prisma } = makeService(null);
    const created = makeCoupon();
    prisma.client.coupon.findUnique.mockResolvedValue(null);
    prisma.client.coupon.create.mockResolvedValue(created);
    const result = await service.create('t1', { code: 'NEW10', type: 'percentage', value: 10 } as any);
    expect(result).toEqual(created);
  });
});

describe('CouponsService#remove', () => {
  it('throws NotFoundException when coupon does not exist', async () => {
    const { service } = makeService(null);
    await expect(service.remove('t1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('deletes the coupon when it exists', async () => {
    const { service, prisma } = makeService();
    await service.remove('t1', 'cpn-1');
    expect(prisma.client.coupon.delete).toHaveBeenCalledWith({ where: { id: 'cpn-1' } });
  });
});
