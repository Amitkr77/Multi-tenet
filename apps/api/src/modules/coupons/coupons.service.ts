import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateCouponDto,
  UpdateCouponDto,
  CouponValidationResult,
} from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string): Promise<any> {
    return this.prisma.client.coupon.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, dto: CreateCouponDto): Promise<any> {
    const existing = await this.prisma.client.coupon.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existing)
      throw new BadRequestException({
        code: 'CONFLICT',
        message: 'A coupon with this code already exists.',
      });
    return this.prisma.client.coupon.create({ data: { tenantId, ...dto } });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateCouponDto,
  ): Promise<any> {
    await this.getOr404(tenantId, id);
    return this.prisma.client.coupon.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.getOr404(tenantId, id);
    await this.prisma.client.coupon.delete({ where: { id } });
  }

  private async getOr404(tenantId: string, id: string): Promise<any> {
    const coupon = await this.prisma.client.coupon.findFirst({
      where: { id, tenantId },
    });
    if (!coupon)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Coupon not found.',
      });
    return coupon;
  }

  /**
   * Public, anonymous-capable preview — checks everything that doesn't need
   * an authenticated customer or real cart contents (active/expiry/global
   * usage limit/min order value). Product/category restriction and the
   * per-customer usage limit need real identity + cart contents, so they're
   * only checked authoritatively by `resolveForCheckout` below, inside the
   * actual checkout flow (M19) — this preview is a UI convenience, not the
   * final word (same "server-side is the real boundary" discipline as
   * everywhere else in this codebase).
   */
  async validatePreview(
    tenantId: string,
    code: string,
    subtotal: number,
  ): Promise<CouponValidationResult> {
    const coupon = await this.prisma.client.coupon.findUnique({
      where: { tenantId_code: { tenantId, code: code.toUpperCase() } },
    });
    if (!coupon) return { valid: false, reason: 'Coupon not found.' };
    return this.checkBasicEligibility(coupon, subtotal);
  }

  /**
   * The authoritative check, called from CheckoutService at order-creation
   * time (real customer, real cart). Does NOT mutate anything itself
   * (usedCount increment + CouponRedemption row creation happen in the same
   * transaction as Order creation, in CheckoutService — see M19) — this
   * method only validates and returns the discount amount to apply.
   */
  async resolveForCheckout(
    tenantId: string,
    code: string,
    customerId: string,
    subtotal: number,
    cartProductIds: string[],
    cartCategoryIds: string[],
  ): Promise<{ couponId: string; discountAmount: number }> {
    const coupon = await this.prisma.client.coupon.findUnique({
      where: { tenantId_code: { tenantId, code: code.toUpperCase() } },
    });
    if (!coupon)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Coupon not found.',
      });

    const basic = this.checkBasicEligibility(coupon, subtotal);
    if (!basic.valid)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: basic.reason,
      });

    if (coupon.restrictedProductIds.length > 0) {
      const allMatch = cartProductIds.every((id: string) =>
        coupon.restrictedProductIds.includes(id),
      );
      if (!allMatch)
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'This coupon does not apply to all items in your cart.',
        });
    }
    if (coupon.restrictedCategoryIds.length > 0) {
      const allMatch = cartCategoryIds.every((id: string) =>
        coupon.restrictedCategoryIds.includes(id),
      );
      if (!allMatch)
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'This coupon does not apply to all items in your cart.',
        });
    }

    if (coupon.perCustomerLimit != null) {
      const redemptions = await this.prisma.client.couponRedemption.count({
        where: { couponId: coupon.id, customerId },
      });
      if (redemptions >= coupon.perCustomerLimit)
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message:
            'You have already used this coupon the maximum number of times.',
        });
    }

    const discountAmount =
      coupon.type === 'percentage'
        ? Math.round(subtotal * (Number(coupon.value) / 100) * 100) / 100
        : Math.min(Number(coupon.value), subtotal);

    return { couponId: coupon.id, discountAmount };
  }

  private checkBasicEligibility(
    coupon: any,
    subtotal: number,
  ): CouponValidationResult {
    if (!coupon.isActive)
      return { valid: false, reason: 'This coupon is no longer active.' };
    if (coupon.expiresAt && coupon.expiresAt < new Date())
      return { valid: false, reason: 'This coupon has expired.' };
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit)
      return {
        valid: false,
        reason: 'This coupon has reached its usage limit.',
      };
    if (coupon.minOrderValue != null && subtotal < Number(coupon.minOrderValue))
      return {
        valid: false,
        reason: `A minimum order of $${Number(coupon.minOrderValue).toFixed(2)} is required for this coupon.`,
      };

    const discountAmount =
      coupon.type === 'percentage'
        ? Math.round(subtotal * (Number(coupon.value) / 100) * 100) / 100
        : Math.min(Number(coupon.value), subtotal);
    return { valid: true, discountAmount };
  }
}
