import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateTaxRuleDto, UpdateTaxRuleDto } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TaxService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string): Promise<any> {
    return this.prisma.client.taxRule.findMany({
      where: { tenantId },
      include: { category: true },
      orderBy: { region: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateTaxRuleDto): Promise<any> {
    return this.prisma.client.taxRule.create({ data: { tenantId, ...dto } });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateTaxRuleDto,
  ): Promise<any> {
    await this.getOr404(tenantId, id);
    return this.prisma.client.taxRule.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.getOr404(tenantId, id);
    await this.prisma.client.taxRule.delete({ where: { id } });
  }

  private async getOr404(tenantId: string, id: string): Promise<any> {
    const rule = await this.prisma.client.taxRule.findFirst({
      where: { id, tenantId },
    });
    if (!rule)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Tax rule not found.',
      });
    return rule;
  }

  /**
   * Matches the same country/`COUNTRY-STATE` composite scheme as
   * ShippingService.calculateShippingCost. A rule optionally restricted to
   * one category only applies if every cart line falls under that category
   * — simplistic (Phase 3 scope: one blended tax rate per order, not
   * per-line-item tax breakdown) but matches FR-S-03's literal ask
   * ("configure tax rules per region/product category") without building a
   * full per-line tax engine this phase doesn't need.
   */
  async calculateTax(
    tenantId: string,
    address: { country: string; state?: string | null },
    subtotal: number,
    cartCategoryIds: string[],
  ): Promise<number> {
    const candidates = [
      address.country,
      address.state ? `${address.country}-${address.state}` : null,
    ].filter((v): v is string => !!v);

    const rules = await this.prisma.client.taxRule.findMany({
      where: { tenantId },
    });
    const matching = (rules as any[]).filter((r) => {
      if (!candidates.includes(r.region)) return false;
      if (r.categoryId && !cartCategoryIds.every((id) => id === r.categoryId))
        return false;
      return true;
    });
    if (matching.length === 0) return 0;

    // A category-restricted rule is more specific than a region-wide one.
    const best = matching.reduce((a, b) =>
      b.categoryId && !a.categoryId ? b : a,
    );
    return Math.round(subtotal * (Number(best.rate) / 100) * 100) / 100;
  }
}
