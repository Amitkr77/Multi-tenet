import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateShippingZoneDto,
  UpdateShippingZoneDto,
  CreateShippingRateDto,
  UpdateShippingRateDto,
} from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

export interface ShippingQuote {
  amount: number;
  rateId: string;
  rateName: string;
}

/**
 * Runs through the normal authenticated request pipeline — `this.prisma.client`
 * (CLS-backed tenant-scoped) is correct here, same as every Phase 2 module.
 */
@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  listZones(tenantId: string): Promise<any> {
    return this.prisma.client.shippingZone.findMany({
      where: { tenantId },
      include: { rates: true },
      orderBy: { name: 'asc' },
    });
  }

  async createZone(tenantId: string, dto: CreateShippingZoneDto): Promise<any> {
    return this.prisma.client.shippingZone.create({
      data: { tenantId, name: dto.name, regions: dto.regions },
    });
  }

  async updateZone(
    tenantId: string,
    id: string,
    dto: UpdateShippingZoneDto,
  ): Promise<any> {
    const zone = await this.getZoneOr404(tenantId, id);
    return this.prisma.client.shippingZone.update({
      where: { id: zone.id },
      data: { ...dto, regions: dto.regions ?? undefined },
    });
  }

  async removeZone(tenantId: string, id: string): Promise<void> {
    await this.getZoneOr404(tenantId, id);
    await this.prisma.client.shippingZone.delete({ where: { id } });
  }

  async addRate(
    tenantId: string,
    zoneId: string,
    dto: CreateShippingRateDto,
  ): Promise<any> {
    await this.getZoneOr404(tenantId, zoneId);
    if (dto.type === 'free_above_threshold' && dto.freeAboveAmount == null) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'freeAboveAmount is required for a free_above_threshold rate.',
      });
    }
    return this.prisma.client.shippingRate.create({
      data: { tenantId, shippingZoneId: zoneId, ...dto },
    });
  }

  async updateRate(
    tenantId: string,
    rateId: string,
    dto: UpdateShippingRateDto,
  ): Promise<any> {
    const rate = await this.prisma.client.shippingRate.findFirst({
      where: { id: rateId, tenantId },
    });
    if (!rate)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Shipping rate not found.',
      });
    return this.prisma.client.shippingRate.update({
      where: { id: rateId },
      data: dto,
    });
  }

  async removeRate(tenantId: string, rateId: string): Promise<void> {
    const rate = await this.prisma.client.shippingRate.findFirst({
      where: { id: rateId, tenantId },
    });
    if (!rate)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Shipping rate not found.',
      });
    await this.prisma.client.shippingRate.delete({ where: { id: rateId } });
  }

  private async getZoneOr404(tenantId: string, id: string): Promise<any> {
    const zone = await this.prisma.client.shippingZone.findFirst({
      where: { id, tenantId },
    });
    if (!zone)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Shipping zone not found.',
      });
    return zone;
  }

  /**
   * Matches a zone whose `regions` list contains the address's country code
   * or `COUNTRY-STATE` composite (e.g. "US" or "CA-BC"), then picks the
   * cheapest applicable rate — a free_above_threshold rate wins outright
   * (cost 0) once the subtotal clears its threshold; otherwise the lowest
   * flat_rate amount in that zone. Returns null if no zone matches (Checkout
   * decides what "no shipping available" means to the customer).
   */
  async calculateShippingCost(
    tenantId: string,
    address: { country: string; state?: string | null },
    subtotal: number,
  ): Promise<ShippingQuote | null> {
    const candidates = [
      address.country,
      address.state ? `${address.country}-${address.state}` : null,
    ].filter((v): v is string => !!v);

    const zones = await this.prisma.client.shippingZone.findMany({
      where: { tenantId },
      include: { rates: true },
    });

    const zone = zones.find((z: any) =>
      (z.regions as string[]).some((region) => candidates.includes(region)),
    );
    if (!zone || zone.rates.length === 0) return null;

    const freeRate = zone.rates.find(
      (r: any) =>
        r.type === 'free_above_threshold' &&
        r.freeAboveAmount != null &&
        subtotal >= Number(r.freeAboveAmount),
    );
    if (freeRate)
      return { amount: 0, rateId: freeRate.id, rateName: freeRate.name };

    const flatRates = zone.rates.filter((r: any) => r.type === 'flat_rate');
    if (flatRates.length === 0) return null;
    const cheapest = flatRates.reduce((min: any, r: any) =>
      Number(r.amount) < Number(min.amount) ? r : min,
    );
    return {
      amount: Number(cheapest.amount),
      rateId: cheapest.id,
      rateName: cheapest.name,
    };
  }
}
