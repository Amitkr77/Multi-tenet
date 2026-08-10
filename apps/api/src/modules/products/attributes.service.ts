import { BadRequestException, Injectable } from '@nestjs/common';
import type { CreateAttributeDto } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AttributesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string): Promise<any> {
    return this.prisma.client.productAttribute.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateAttributeDto): Promise<any> {
    const existing = await this.prisma.client.productAttribute.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing)
      throw new BadRequestException({
        code: 'CONFLICT',
        message: 'This attribute already exists.',
      });
    return this.prisma.client.productAttribute.create({
      data: { tenantId, name: dto.name },
    });
  }
}
