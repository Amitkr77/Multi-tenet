import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateWarehouseDto, UpdateWarehouseDto } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string): Promise<any[]> {
    return this.prisma.client.warehouse.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    }) as Promise<any[]>;
  }

  async create(tenantId: string, dto: CreateWarehouseDto) {
    return this.prisma.client.warehouse.create({
      data: { tenantId, name: dto.name, isDefault: false },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateWarehouseDto) {
    await this.getOr404(tenantId, id);
    return this.prisma.client.warehouse.update({ where: { id }, data: dto });
  }

  async setDefault(tenantId: string, id: string) {
    await this.getOr404(tenantId, id);
    // clear existing default, then set new one — two ops in one transaction
    await this.prisma.client.$transaction([
      this.prisma.client.warehouse.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.client.warehouse.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);
    return this.prisma.client.warehouse.findUniqueOrThrow({ where: { id } });
  }

  async remove(tenantId: string, id: string) {
    const wh = await this.getOr404(tenantId, id);
    if (wh.isDefault) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Cannot delete the default warehouse. Set another warehouse as default first.',
      });
    }
    await this.prisma.client.warehouse.delete({ where: { id } });
  }

  private async getOr404(tenantId: string, id: string) {
    const wh = await this.prisma.client.warehouse.findFirst({ where: { id, tenantId } });
    if (!wh) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Warehouse not found.' });
    return wh;
  }
}
