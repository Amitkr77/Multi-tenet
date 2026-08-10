import { Injectable } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';
import type { AnalyticsExportQuery, DateRangeQuery } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AnalyticsPdfService } from './analytics-pdf.service';
import {
  buildCsvRows,
  bucketCounts,
  bucketRevenue,
  computeRepeatPurchaseStats,
  computeTurnoverRatio,
  groupBestSellers,
  mergeLowPerformers,
} from './analytics.utils';

const DEFAULT_RANGE_DAYS = 30;

// Orders in any of these statuses represent a genuinely completed
// purchase — `pending` isn't paid yet, `cancelled`/`refunded` had payment
// reversed. Kept in sync with ReviewsService's ELIGIBLE_ORDER_STATUSES
// deliberately (same underlying notion of "this was a real sale").
//
// Disclosed simplification: partial refunds are NOT netted out of these
// figures (an order with a partial refund keeps its full grandTotal
// counted) — precise netting would require summing Refund rows per order
// on every query; deferred as a real, non-blocking gap.
const ELIGIBLE_ORDER_STATUSES = ['paid', 'fulfilled', 'shipped', 'delivered'];

/**
 * Every method here fetches tenant-scoped rows via `prisma.client.*`
 * (`findMany`/`groupBy` — both go through the tenant-scoping Prisma
 * extension) and buckets/aggregates in JS. `$queryRaw` is never used:
 * it bypasses that extension entirely (only wraps model operations), which
 * would silently break RLS enforcement for this module — see
 * InventoryService's own comment on the same constraint.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly pdfService: AnalyticsPdfService,
  ) {}

  private async computeByType(
    tenantId: string,
    query: DateRangeQuery,
    type: string,
  ): Promise<any> {
    switch (type) {
      case 'revenue':
        return this.revenue(tenantId, query);
      case 'orders':
        return this.orders(tenantId, query);
      case 'best-sellers':
        return this.bestSellers(tenantId, query);
      case 'customers':
        return this.customers(tenantId, query);
      case 'inventory':
        return this.inventory(tenantId, query);
      default:
        return null;
    }
  }

  /** FR-AN-04 — CSV reuses the exact ProductsService#bulkExport pattern; PDF delegates to AnalyticsPdfService (the one place touching pdfkit). */
  async export(
    tenantId: string,
    query: AnalyticsExportQuery,
  ): Promise<{ contentType: string; filename: string; body: string | Buffer }> {
    const data = await this.computeByType(tenantId, query, query.type);
    const tenant = await this.prisma.client.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true },
    });

    if (query.format === 'csv') {
      const rows = buildCsvRows(query.type, data);
      return {
        contentType: 'text/csv',
        filename: `analytics-${query.type}.csv`,
        body: stringify(rows, { header: true }),
      };
    }

    const buffer = await this.pdfService.render(query.type, data, {
      tenantName: tenant.name,
      from: data.from,
      to: data.to,
    });
    return {
      contentType: 'application/pdf',
      filename: `analytics-${query.type}.pdf`,
      body: buffer,
    };
  }

  private resolveRange(query: DateRangeQuery): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  private async eligibleOrdersInRange(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<{ createdAt: Date; grandTotal: number }[]> {
    const orders = await this.prisma.client.order.findMany({
      where: {
        tenantId,
        status: { in: ELIGIBLE_ORDER_STATUSES as any },
        createdAt: { gte: from, lte: to },
      },
      select: { createdAt: true, grandTotal: true },
    });
    return orders.map((o: any) => ({
      createdAt: o.createdAt,
      grandTotal: Number(o.grandTotal),
    }));
  }

  async revenue(tenantId: string, query: DateRangeQuery): Promise<any> {
    const { from, to } = this.resolveRange(query);
    const orders = await this.eligibleOrdersInRange(tenantId, from, to);
    const buckets = bucketRevenue(orders, query.granularity);
    const totalRevenue = buckets.reduce((sum, b) => sum + b.revenue, 0);
    return {
      granularity: query.granularity,
      from,
      to,
      buckets: buckets.map(({ bucket, revenue }) => ({ bucket, revenue })),
      totalRevenue,
    };
  }

  async orders(tenantId: string, query: DateRangeQuery): Promise<any> {
    const { from, to } = this.resolveRange(query);
    const orders = await this.eligibleOrdersInRange(tenantId, from, to);
    const buckets = bucketRevenue(orders, query.granularity);
    const totalOrders = buckets.reduce((sum, b) => sum + b.orderCount, 0);
    const totalRevenue = buckets.reduce((sum, b) => sum + b.revenue, 0);
    return {
      granularity: query.granularity,
      from,
      to,
      buckets: buckets.map((b) => ({
        bucket: b.bucket,
        orderCount: b.orderCount,
        aov: b.orderCount > 0 ? b.revenue / b.orderCount : 0,
      })),
      totalOrders,
      overallAOV: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    };
  }

  async bestSellers(tenantId: string, query: DateRangeQuery): Promise<any> {
    const { from, to } = this.resolveRange(query);
    const items = await this.prisma.client.orderItem.findMany({
      where: {
        tenantId,
        order: {
          tenantId,
          status: { in: ELIGIBLE_ORDER_STATUSES as any },
          createdAt: { gte: from, lte: to },
        },
      },
      select: {
        productName: true,
        sku: true,
        quantity: true,
        lineTotal: true,
        variant: {
          select: { productId: true, product: { select: { slug: true } } },
        },
      },
    });
    const grouped = groupBestSellers(
      items.map((i: any) => ({
        productName: i.productName,
        sku: i.sku,
        quantity: i.quantity,
        lineTotal: Number(i.lineTotal),
        currentProductId: i.variant?.productId ?? null,
        currentSlug: i.variant?.product?.slug ?? null,
      })),
    );

    const bestSellers = [...grouped]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20);

    const publishedProducts = await this.prisma.client.product.findMany({
      where: { tenantId, status: 'published' },
      select: { id: true, name: true, slug: true },
    });
    const lowPerformers = mergeLowPerformers(publishedProducts, grouped).slice(
      0,
      20,
    );

    return { from, to, bestSellers, lowPerformers };
  }

  /** FR-AN-03 — acquisition (new Customer rows in range) + repeat-purchase rate. */
  async customers(tenantId: string, query: DateRangeQuery): Promise<any> {
    const { from, to } = this.resolveRange(query);

    const newCustomers = await this.prisma.client.customer.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to } },
      select: { createdAt: true },
    });
    const newCustomersByBucket = bucketCounts(
      newCustomers.map((c: any) => c.createdAt),
      query.granularity,
    );

    // `groupBy` is a model operation — goes through the tenant-scoping
    // extension, unlike `$queryRaw`, so this stays RLS-safe.
    const purchaseCounts = await this.prisma.client.order.groupBy({
      by: ['customerId'],
      where: {
        tenantId,
        status: { in: ELIGIBLE_ORDER_STATUSES as any },
        createdAt: { gte: from, lte: to },
      },
      _count: { _all: true },
    });
    const stats = computeRepeatPurchaseStats(
      purchaseCounts.map((p: any) => ({ orderCount: p._count._all })),
    );

    return {
      granularity: query.granularity,
      from,
      to,
      newCustomersByBucket,
      totalNewCustomers: newCustomers.length,
      ...stats,
    };
  }

  /** FR-AN-05 — stock value, a turnover proxy, and low-stock items (reusing InventoryService directly). */
  async inventory(tenantId: string, query: DateRangeQuery): Promise<any> {
    const { from, to } = this.resolveRange(query);

    const lowStockItems = await this.inventoryService.list(tenantId, {
      lowStock: true,
    });

    const rows = await this.prisma.client.inventory.findMany({
      where: { tenantId },
      include: {
        variant: {
          select: { price: true, product: { select: { basePrice: true } } },
        },
      },
    });
    const stockValue = rows.reduce(
      (sum: number, r: any) =>
        sum +
        r.quantityOnHand *
          Number(r.variant.price ?? r.variant.product.basePrice),
      0,
    );
    const currentQuantityOnHand = rows.reduce(
      (sum: number, r: any) => sum + r.quantityOnHand,
      0,
    );

    const soldItems = await this.prisma.client.orderItem.findMany({
      where: {
        tenantId,
        order: {
          tenantId,
          status: { in: ELIGIBLE_ORDER_STATUSES as any },
          createdAt: { gte: from, lte: to },
        },
      },
      select: { quantity: true },
    });
    const unitsSoldInRange = soldItems.reduce(
      (sum: number, i: any) => sum + i.quantity,
      0,
    );

    return {
      from,
      to,
      stockValue,
      unitsSoldInRange,
      currentQuantityOnHand,
      turnoverRatio: computeTurnoverRatio(
        unitsSoldInRange,
        currentQuantityOnHand,
      ),
      lowStockItems,
    };
  }
}
