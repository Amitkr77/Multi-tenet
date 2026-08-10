import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateReviewDto, ModerateReviewDto } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

// Orders in any of these statuses represent a genuinely completed purchase —
// `pending` isn't paid yet, `cancelled`/`refunded` had payment reversed.
// Same eligible-status set as OrdersService/AnalyticsService use for
// "revenue-recognized" — kept in sync deliberately.
const ELIGIBLE_ORDER_STATUSES = ['paid', 'fulfilled', 'shipped', 'delivered'];

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public — only ever returns `approved` reviews, alongside an aggregate
   * average/count computed the same tenant-scoped way (two model queries,
   * not raw SQL — RLS-safe).
   */
  async listApproved(tenantId: string, productId: string): Promise<any> {
    const [reviews, aggregate] = await Promise.all([
      this.prisma.client.review.findMany({
        where: { tenantId, productId, status: 'approved' },
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.client.review.aggregate({
        where: { tenantId, productId, status: 'approved' },
        _avg: { rating: true },
        _count: true,
      }),
    ]);
    return {
      average: aggregate._avg.rating,
      count: aggregate._count,
      reviews,
    };
  }

  /**
   * Customer-facing. FR-R-01 ties review submission to "purchased
   * products" — eligibility is an OR of two paths (see schema.prisma's
   * comment on Review): a precise join through the still-live variant, or a
   * fallback match on the snapshotted productName for orders whose variant
   * has since been deleted. Disclosed tradeoff: the fallback could, in a
   * rare case, match a different product that happened to share the exact
   * same name at time of purchase — an acceptable bar for a review-
   * eligibility gate (see plan Context).
   */
  async create(
    tenantId: string,
    customerId: string,
    productId: string,
    dto: CreateReviewDto,
  ): Promise<any> {
    const product = await this.prisma.client.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Product not found.',
      });
    }

    const eligible = await this.prisma.client.orderItem.findFirst({
      where: {
        tenantId,
        order: {
          tenantId,
          customerId,
          status: { in: ELIGIBLE_ORDER_STATUSES as any },
        },
        OR: [{ variant: { productId } }, { productName: product.name }],
      },
    });
    if (!eligible) {
      throw new ForbiddenException({
        code: 'NOT_ELIGIBLE',
        message: 'You can only review products from a completed order.',
      });
    }

    try {
      return await this.prisma.client.review.create({
        data: {
          tenantId,
          productId,
          customerId,
          rating: dto.rating,
          comment: dto.comment,
        },
      });
    } catch (err: any) {
      if (err?.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION) {
        throw new ConflictException({
          code: 'ALREADY_REVIEWED',
          message: 'You have already reviewed this product.',
        });
      }
      throw err;
    }
  }

  /** Staff moderation queue — not in the literal spec table, but needed for the dashboard queue page (`reviews.view`). */
  listForModeration(
    tenantId: string,
    filters: { status?: string; productId?: string },
  ): Promise<any> {
    return this.prisma.client.review.findMany({
      where: {
        tenantId,
        status: (filters.status as any) ?? undefined,
        productId: filters.productId,
      },
      include: {
        product: { select: { id: true, name: true, slug: true } },
        customer: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async moderate(
    tenantId: string,
    id: string,
    dto: ModerateReviewDto,
  ): Promise<any> {
    const result = await this.prisma.client.review.updateMany({
      where: { id, tenantId },
      data: { status: dto.status },
    });
    if (result.count === 0) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Review not found.',
      });
    }
    return this.prisma.client.review.findFirst({ where: { id, tenantId } });
  }
}
