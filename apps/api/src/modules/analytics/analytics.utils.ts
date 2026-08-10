/**
 * Pure calculation helpers for AnalyticsService — kept dependency-free (no
 * Prisma/Nest imports) so they can be unit-tested directly with synthetic
 * data, same discipline as Phase 3's calculateShippingCost/calculateTax.
 *
 * No date library added for bucketing (day/week/month) — native Date math
 * is enough for a handful of pure functions and there's no existing
 * precedent to match. "Week" buckets key off the Monday that starts the
 * ISO week containing the date (not a numbered ISO week) — simpler than a
 * full ISO-8601 week-number algorithm while staying deterministic and
 * chronologically sortable as a plain string.
 */

export type Granularity = 'day' | 'week' | 'month';

function startOfIsoWeekUtc(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = d.getUTCDay(); // 0 (Sun) .. 6 (Sat)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d;
}

export function bucketKey(
  date: Date | string,
  granularity: Granularity,
): string {
  const d = new Date(date);
  if (granularity === 'day') return d.toISOString().slice(0, 10);
  if (granularity === 'week')
    return startOfIsoWeekUtc(d).toISOString().slice(0, 10);
  return d.toISOString().slice(0, 7); // month, e.g. "2026-08"
}

export interface OrderForBucketing {
  createdAt: Date | string;
  grandTotal: number;
}

export interface RevenueBucket {
  bucket: string;
  revenue: number;
  orderCount: number;
}

/**
 * Shared bucketing logic backing both /analytics/revenue (uses `revenue`)
 * and /analytics/orders (uses `orderCount`, and derives AOV per bucket) —
 * one pass over the order set, sorted chronologically by bucket key.
 */
export function bucketRevenue(
  orders: OrderForBucketing[],
  granularity: Granularity,
): RevenueBucket[] {
  const buckets = new Map<string, { revenue: number; orderCount: number }>();
  for (const order of orders) {
    const key = bucketKey(order.createdAt, granularity);
    const existing = buckets.get(key) ?? { revenue: 0, orderCount: 0 };
    existing.revenue += order.grandTotal;
    existing.orderCount += 1;
    buckets.set(key, existing);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([bucket, v]) => ({ bucket, ...v }));
}

export interface OrderItemForGrouping {
  productName: string;
  sku: string;
  quantity: number;
  lineTotal: number;
  // Opportunistic — present only when the OrderItem's variant/product
  // hasn't since been deleted. Used purely for dashboard deep-links, NEVER
  // as the grouping key (see Review's/best-sellers' schema.prisma comments
  // on why: OrderItem has no direct productId, only a nullable variantId).
  currentProductId?: string | null;
  currentSlug?: string | null;
}

export interface BestSellerGroup {
  productName: string;
  sku: string;
  quantity: number;
  revenue: number;
  productId: string | null;
  slug: string | null;
}

/**
 * Groups by the snapshotted (productName, sku) pair, not by a live
 * variantId->productId join — a hard-deleted variant/product would
 * otherwise silently drop or under-count historical order lines (see
 * AnalyticsService's own comment for the full disclosed tradeoff). Proven
 * by the unit test that feeds a row with no `currentProductId` at all.
 */
export function groupBestSellers(
  items: OrderItemForGrouping[],
): BestSellerGroup[] {
  const groups = new Map<string, BestSellerGroup>();
  for (const item of items) {
    const key = `${item.productName}|||${item.sku}`;
    const existing = groups.get(key) ?? {
      productName: item.productName,
      sku: item.sku,
      quantity: 0,
      revenue: 0,
      productId: null,
      slug: null,
    };
    existing.quantity += item.quantity;
    existing.revenue += item.lineTotal;
    if (!existing.productId && item.currentProductId)
      existing.productId = item.currentProductId;
    if (!existing.slug && item.currentSlug) existing.slug = item.currentSlug;
    groups.set(key, existing);
  }
  return [...groups.values()];
}

/** Counts occurrences per bucket — used for customer-acquisition series (FR-AN-03). */
export function bucketCounts(
  dates: (Date | string)[],
  granularity: Granularity,
): { bucket: string; count: number }[] {
  const buckets = new Map<string, number>();
  for (const d of dates) {
    const key = bucketKey(d, granularity);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([bucket, count]) => ({ bucket, count }));
}

export interface RepeatPurchaseStats {
  repeatCustomers: number;
  oneTimeCustomers: number;
  repeatPurchaseRate: number;
}

/**
 * FR-AN-03. `counts` is one entry per customer with an eligible order in
 * range (from Order.groupBy) — a customer with 2+ orders is "repeat", with
 * exactly 1 is "one-time". Rate is 0 (not NaN) when nobody ordered at all.
 */
export function computeRepeatPurchaseStats(
  counts: { orderCount: number }[],
): RepeatPurchaseStats {
  const repeatCustomers = counts.filter((c) => c.orderCount > 1).length;
  const oneTimeCustomers = counts.filter((c) => c.orderCount === 1).length;
  const total = repeatCustomers + oneTimeCustomers;
  return {
    repeatCustomers,
    oneTimeCustomers,
    repeatPurchaseRate: total > 0 ? repeatCustomers / total : 0,
  };
}

/**
 * FR-AN-05 turnover — disclosed limitation: no COGS field and no
 * historical stock-level snapshot table exist in this schema, so this is a
 * proxy (units sold in range / CURRENT on-hand stock standing in for
 * "average" stock), not a textbook COGS/average-inventory-value formula.
 * `null` (not a divide-by-zero NaN/Infinity) when there's no stock at all.
 */
export function computeTurnoverRatio(
  unitsSoldInRange: number,
  currentQuantityOnHand: number,
): number | null {
  if (currentQuantityOnHand <= 0) return null;
  return unitsSoldInRange / currentQuantityOnHand;
}

export interface LowPerformer {
  productId: string;
  name: string;
  slug: string;
  quantity: number;
}

/**
 * A published product with zero sales never appears in the OrderItem-driven
 * groupBestSellers() output at all — this merges the full published-product
 * list against what did sell (matched by name, same snapshot-based join as
 * grouping itself) so zero-sales products surface as "low performers"
 * rather than being invisible.
 */
/**
 * Flattens each analytics endpoint's already-computed response shape into a
 * uniform array of plain objects for CSV export — same "flat array of plain
 * objects, then `stringify(rows, { header: true })`" pattern as
 * ProductsService#bulkExport, byte-for-byte (see AnalyticsService#export).
 * Every row for a given type shares the same key set (blank string where a
 * summary-only field doesn't apply to a per-bucket row) so csv-stringify's
 * header-inference produces one consistent column set.
 */
export function buildCsvRows(
  type: string,
  data: any,
): Record<string, unknown>[] {
  switch (type) {
    case 'revenue':
      return data.buckets.map((b: any) => ({
        bucket: b.bucket,
        revenue: b.revenue,
      }));

    case 'orders':
      return data.buckets.map((b: any) => ({
        bucket: b.bucket,
        orderCount: b.orderCount,
        aov: b.aov,
      }));

    case 'best-sellers':
      return [
        ...data.bestSellers.map((b: any) => ({
          section: 'best_seller',
          productName: b.productName,
          sku: b.sku,
          quantity: b.quantity,
          revenue: b.revenue,
        })),
        ...data.lowPerformers.map((p: any) => ({
          section: 'low_performer',
          productName: p.name,
          sku: '',
          quantity: p.quantity,
          revenue: '',
        })),
      ];

    case 'customers':
      return [
        ...data.newCustomersByBucket.map((b: any) => ({
          bucket: b.bucket,
          newCustomers: b.count,
          repeatCustomers: '',
          oneTimeCustomers: '',
          repeatPurchaseRate: '',
        })),
        {
          bucket: 'TOTAL',
          newCustomers: data.totalNewCustomers,
          repeatCustomers: data.repeatCustomers,
          oneTimeCustomers: data.oneTimeCustomers,
          repeatPurchaseRate: data.repeatPurchaseRate,
        },
      ];

    case 'inventory':
      return [
        {
          sku: 'SUMMARY',
          productName: '',
          quantityOnHand: data.currentQuantityOnHand,
          lowStockThreshold: '',
          note: `stockValue=${data.stockValue}, unitsSoldInRange=${data.unitsSoldInRange}, turnoverRatio=${data.turnoverRatio ?? 'n/a'}`,
        },
        ...data.lowStockItems.map((item: any) => ({
          sku: item.variant?.sku ?? '',
          productName: item.variant?.product?.name ?? '',
          quantityOnHand: item.quantityOnHand,
          lowStockThreshold: item.lowStockThreshold ?? '',
          note: 'low stock',
        })),
      ];

    default:
      return [];
  }
}

export function mergeLowPerformers(
  publishedProducts: { id: string; name: string; slug: string }[],
  sold: BestSellerGroup[],
): LowPerformer[] {
  const soldByName = new Map(sold.map((s) => [s.productName, s.quantity]));
  return publishedProducts
    .map((p) => ({
      productId: p.id,
      name: p.name,
      slug: p.slug,
      quantity: soldByName.get(p.name) ?? 0,
    }))
    .sort((a, b) => a.quantity - b.quantity);
}
