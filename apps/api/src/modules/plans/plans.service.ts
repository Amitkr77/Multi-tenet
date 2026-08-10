import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreatePlanDto, UpdatePlanDto } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * `plans`/`plan_limits` have no RLS policy (platform-level config, not
 * tenant-owned — same as every other Super Admin / public-catalogue read in
 * this module), so `prisma.base` is correct throughout, no `runScoped`
 * needed anywhere here.
 */
@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public — FR-T-04's pre-signup plan picker and the billing upgrade UI both read this. */
  listPublic(): Promise<any> {
    return this.prisma.base.plan.findMany({
      where: { archivedAt: null },
      include: { limits: true },
      orderBy: { price: 'asc' },
    });
  }

  async getById(id: string): Promise<any> {
    const plan = await this.prisma.base.plan.findUnique({
      where: { id },
      include: { limits: true },
    });
    if (!plan) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Plan not found.',
      });
    }
    return plan;
  }

  async create(dto: CreatePlanDto): Promise<any> {
    return this.prisma.base.$transaction(async (tx) => {
      // Exactly one Plan should have isDefault:true (AuthService#register
      // relies on this) — enforced here, not just "by convention," since
      // Plan CRUD (this method) is the only thing that can violate it.
      if (dto.isDefault) {
        await tx.plan.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.plan.create({
        data: {
          name: dto.name,
          price: dto.price,
          billingInterval: dto.billingInterval,
          stripePriceId: dto.stripePriceId,
          isDefault: dto.isDefault,
          limits: { create: dto.limits },
        },
        include: { limits: true },
      });
    });
  }

  async update(id: string, dto: UpdatePlanDto): Promise<any> {
    await this.getById(id);
    return this.prisma.base.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.plan.updateMany({
          where: { isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }
      if (dto.limits) {
        await tx.planLimit.deleteMany({ where: { planId: id } });
      }
      return tx.plan.update({
        where: { id },
        data: {
          name: dto.name,
          price: dto.price,
          billingInterval: dto.billingInterval,
          stripePriceId: dto.stripePriceId,
          isDefault: dto.isDefault,
          limits: dto.limits ? { create: dto.limits } : undefined,
        },
        include: { limits: true },
      });
    });
  }

  /** Soft-archive only — never a hard delete, Subscription.planId FKs must survive. */
  async archive(id: string): Promise<any> {
    await this.getById(id);
    return this.prisma.base.plan.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }
}
