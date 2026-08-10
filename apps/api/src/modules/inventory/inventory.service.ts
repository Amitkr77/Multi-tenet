import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AdjustInventoryDto,
  SetLowStockThresholdDto,
  TransferInventoryDto,
} from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const INVENTORY_INCLUDE = {
  variant: {
    include: { product: { select: { id: true, name: true, slug: true } } },
  },
  warehouse: true,
};

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `lowStock` filtering happens in JS, not a Prisma `where` clause — Prisma's
   * fluent API can't express a column-to-column comparison
   * (quantity_on_hand <= low_stock_threshold), and the alternative
   * ($queryRaw) would silently bypass the tenant-scoping extension entirely
   * (it only wraps model operations, not raw queries — see
   * tenant-extension.ts). Fetching tenant-scoped rows normally and filtering
   * in-process keeps this on the one query path that's actually RLS-safe;
   * fine at Phase 2's data scale.
   */
  async list(
    tenantId: string,
    filters: { lowStock?: boolean; warehouseId?: string },
  ): Promise<any> {
    const rows = await this.prisma.client.inventory.findMany({
      where: { tenantId, warehouseId: filters.warehouseId },
      include: INVENTORY_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    if (!filters.lowStock) return rows;
    return rows.filter(
      (r: any) =>
        r.lowStockThreshold != null && r.quantityOnHand <= r.lowStockThreshold,
    );
  }

  private async getByVariant(
    tenantId: string,
    variantId: string,
    warehouseId?: string,
  ): Promise<any> {
    // A variant can exist against multiple warehouses in principle (Phase 6);
    // Phase 2 has exactly one (the tenant's default), so "the" inventory row
    // for a variant is unambiguous today.
    const inventory = await this.prisma.client.inventory.findFirst({
      where: { variantId, tenantId, ...(warehouseId ? { warehouseId } : {}) },
      include: INVENTORY_INCLUDE,
    });
    if (!inventory)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'No inventory record for this variant.',
      });
    return inventory;
  }

  async adjust(
    tenantId: string,
    variantId: string,
    dto: AdjustInventoryDto,
    actorUserId: string,
  ): Promise<any> {
    const { warehouseId, ...adjustData } = dto;
    const inventory = await this.getByVariant(tenantId, variantId, warehouseId);
    const newQuantity = inventory.quantityOnHand + adjustData.delta;
    if (newQuantity < 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Adjustment would result in negative stock (current: ${inventory.quantityOnHand}, delta: ${adjustData.delta}).`,
      });
    }

    await this.prisma.client.$transaction([
      this.prisma.client.inventory.update({
        where: { id: inventory.id },
        data: { quantityOnHand: newQuantity },
      }),
      this.prisma.client.inventoryAdjustment.create({
        data: {
          tenantId,
          inventoryId: inventory.id,
          delta: adjustData.delta,
          reasonCode: adjustData.reasonCode,
          note: adjustData.note,
          actorUserId,
        },
      }),
    ]);

    return this.getByVariant(tenantId, variantId, warehouseId);
  }

  /**
   * FR-I-04 — kept as its own endpoint/permission (`inventory.manage_alerts`,
   * distinct from `inventory.adjust`) even though 06-api-specification.md's
   * `PATCH /inventory/:variantId` only documents stock adjustment — matrix
   * already grants Manager `inventory.manage_alerts` separately from
   * `inventory.adjust` (Owner/Admin only), so folding threshold-setting into
   * the adjust endpoint would blur a distinction the permission matrix
   * already draws.
   */
  async setLowStockThreshold(
    tenantId: string,
    variantId: string,
    dto: SetLowStockThresholdDto,
  ): Promise<any> {
    const inventory = await this.getByVariant(tenantId, variantId);
    await this.prisma.client.inventory.update({
      where: { id: inventory.id },
      data: { lowStockThreshold: dto.lowStockThreshold },
    });
    return this.getByVariant(tenantId, variantId);
  }

  async transfer(
    tenantId: string,
    dto: TransferInventoryDto,
    actorUserId: string,
  ): Promise<void> {
    const { variantId, fromWarehouseId, toWarehouseId, quantity, note } = dto;
    if (fromWarehouseId === toWarehouseId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Source and destination warehouse must be different.',
      });
    }
    const from = await this.getByVariant(tenantId, variantId, fromWarehouseId);
    const to = await this.getByVariant(tenantId, variantId, toWarehouseId);
    if (from.quantityOnHand < quantity) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Insufficient stock in source warehouse (available: ${from.quantityOnHand}).`,
      });
    }
    await this.prisma.client.$transaction([
      this.prisma.client.inventory.update({
        where: { id: from.id },
        data: { quantityOnHand: from.quantityOnHand - quantity },
      }),
      this.prisma.client.inventory.update({
        where: { id: to.id },
        data: { quantityOnHand: to.quantityOnHand + quantity },
      }),
      this.prisma.client.inventoryAdjustment.create({
        data: {
          tenantId,
          inventoryId: from.id,
          delta: -quantity,
          reasonCode: 'manual_correction',
          note: note ?? `Transfer to warehouse ${toWarehouseId}`,
          actorUserId,
        },
      }),
      this.prisma.client.inventoryAdjustment.create({
        data: {
          tenantId,
          inventoryId: to.id,
          delta: quantity,
          reasonCode: 'manual_correction',
          note: note ?? `Transfer from warehouse ${fromWarehouseId}`,
          actorUserId,
        },
      }),
    ]);
  }

  async history(tenantId: string, variantId: string): Promise<any> {
    const inventory = await this.getByVariant(tenantId, variantId);
    return this.prisma.client.inventoryAdjustment.findMany({
      where: { inventoryId: inventory.id, tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
