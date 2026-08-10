import {
  bucketKey,
  bucketRevenue,
  computeRepeatPurchaseStats,
  computeTurnoverRatio,
  groupBestSellers,
  mergeLowPerformers,
} from './analytics.utils';

/**
 * Direct unit tests of the pure calculation logic (no NestJS/Prisma
 * involved) — same "trust the numbers before a chart renders them"
 * discipline as ShippingService/TaxService's Phase 3 unit tests.
 */
describe('bucketKey', () => {
  it('buckets by calendar day', () => {
    expect(bucketKey('2026-08-05T14:30:00.000Z', 'day')).toBe('2026-08-05');
  });

  it('buckets by the Monday starting the ISO week', () => {
    // 2026-08-05 is a Wednesday; the week's Monday is 2026-08-03.
    expect(bucketKey('2026-08-05T14:30:00.000Z', 'week')).toBe('2026-08-03');
  });

  it('buckets by calendar month', () => {
    expect(bucketKey('2026-08-05T14:30:00.000Z', 'month')).toBe('2026-08');
  });
});

describe('bucketRevenue', () => {
  it('sums revenue and counts orders per day bucket', () => {
    const buckets = bucketRevenue(
      [
        { createdAt: '2026-08-05T01:00:00.000Z', grandTotal: 10 },
        { createdAt: '2026-08-05T23:00:00.000Z', grandTotal: 20 },
        { createdAt: '2026-08-06T01:00:00.000Z', grandTotal: 5 },
      ],
      'day',
    );
    expect(buckets).toEqual([
      { bucket: '2026-08-05', revenue: 30, orderCount: 2 },
      { bucket: '2026-08-06', revenue: 5, orderCount: 1 },
    ]);
  });

  it('returns buckets sorted chronologically regardless of input order', () => {
    const buckets = bucketRevenue(
      [
        { createdAt: '2026-08-06T00:00:00.000Z', grandTotal: 1 },
        { createdAt: '2026-08-01T00:00:00.000Z', grandTotal: 2 },
      ],
      'day',
    );
    expect(buckets.map((b) => b.bucket)).toEqual(['2026-08-01', '2026-08-06']);
  });

  it('returns an empty array for no orders', () => {
    expect(bucketRevenue([], 'day')).toEqual([]);
  });
});

describe('groupBestSellers', () => {
  it('groups by productName+sku, summing quantity and revenue', () => {
    const grouped = groupBestSellers([
      {
        productName: 'Widget',
        sku: 'W-1',
        quantity: 2,
        lineTotal: 20,
        currentProductId: 'p1',
        currentSlug: 'widget',
      },
      {
        productName: 'Widget',
        sku: 'W-1',
        quantity: 3,
        lineTotal: 30,
        currentProductId: 'p1',
        currentSlug: 'widget',
      },
      {
        productName: 'Gadget',
        sku: 'G-1',
        quantity: 1,
        lineTotal: 15,
        currentProductId: 'p2',
        currentSlug: 'gadget',
      },
    ]);
    expect(grouped).toEqual(
      expect.arrayContaining([
        {
          productName: 'Widget',
          sku: 'W-1',
          quantity: 5,
          revenue: 50,
          productId: 'p1',
          slug: 'widget',
        },
        {
          productName: 'Gadget',
          sku: 'G-1',
          quantity: 1,
          revenue: 15,
          productId: 'p2',
          slug: 'gadget',
        },
      ]),
    );
    expect(grouped).toHaveLength(2);
  });

  /**
   * The whole point of grouping by the snapshotted (productName, sku) pair
   * rather than a live variantId->productId join: an OrderItem whose
   * variant has since been hard-deleted (variantId SetNull'd) has no
   * `currentProductId`/`currentSlug` at all, yet must still group and sum
   * correctly using only the snapshot fields.
   */
  it('still groups correctly when the variant/product has since been deleted (no currentProductId)', () => {
    const grouped = groupBestSellers([
      {
        productName: 'Discontinued Item',
        sku: 'D-1',
        quantity: 4,
        lineTotal: 40,
        currentProductId: null,
        currentSlug: null,
      },
      {
        productName: 'Discontinued Item',
        sku: 'D-1',
        quantity: 1,
        lineTotal: 10,
        currentProductId: null,
        currentSlug: null,
      },
    ]);
    expect(grouped).toEqual([
      {
        productName: 'Discontinued Item',
        sku: 'D-1',
        quantity: 5,
        revenue: 50,
        productId: null,
        slug: null,
      },
    ]);
  });

  it('fills in productId/slug opportunistically even if the first row lacks them', () => {
    const grouped = groupBestSellers([
      {
        productName: 'Widget',
        sku: 'W-1',
        quantity: 1,
        lineTotal: 10,
        currentProductId: null,
        currentSlug: null,
      },
      {
        productName: 'Widget',
        sku: 'W-1',
        quantity: 1,
        lineTotal: 10,
        currentProductId: 'p1',
        currentSlug: 'widget',
      },
    ]);
    expect(grouped[0]).toEqual({
      productName: 'Widget',
      sku: 'W-1',
      quantity: 2,
      revenue: 20,
      productId: 'p1',
      slug: 'widget',
    });
  });
});

describe('computeRepeatPurchaseStats', () => {
  it('classifies customers with 2+ orders as repeat, exactly 1 as one-time', () => {
    const stats = computeRepeatPurchaseStats([
      { orderCount: 3 },
      { orderCount: 1 },
      { orderCount: 2 },
      { orderCount: 1 },
    ]);
    expect(stats).toEqual({
      repeatCustomers: 2,
      oneTimeCustomers: 2,
      repeatPurchaseRate: 0.5,
    });
  });

  it('returns rate 0 (not NaN) when nobody ordered at all', () => {
    expect(computeRepeatPurchaseStats([])).toEqual({
      repeatCustomers: 0,
      oneTimeCustomers: 0,
      repeatPurchaseRate: 0,
    });
  });
});

describe('computeTurnoverRatio', () => {
  it('divides units sold by current on-hand stock', () => {
    expect(computeTurnoverRatio(50, 100)).toBe(0.5);
  });

  it('guards against division by zero — returns null when there is no stock on hand', () => {
    expect(computeTurnoverRatio(50, 0)).toBeNull();
  });

  it('guards against negative on-hand stock too', () => {
    expect(computeTurnoverRatio(50, -1)).toBeNull();
  });
});

describe('mergeLowPerformers', () => {
  it('surfaces a published product with zero sales at quantity 0', () => {
    const merged = mergeLowPerformers(
      [
        { id: 'p1', name: 'Bestseller', slug: 'bestseller' },
        { id: 'p2', name: 'Never Sold', slug: 'never-sold' },
      ],
      [
        {
          productName: 'Bestseller',
          sku: 'B-1',
          quantity: 10,
          revenue: 100,
          productId: 'p1',
          slug: 'bestseller',
        },
      ],
    );
    expect(merged).toEqual([
      { productId: 'p2', name: 'Never Sold', slug: 'never-sold', quantity: 0 },
      { productId: 'p1', name: 'Bestseller', slug: 'bestseller', quantity: 10 },
    ]);
  });
});
