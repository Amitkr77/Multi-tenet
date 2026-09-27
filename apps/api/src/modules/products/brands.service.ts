import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateBrandDto, UpdateBrandDto } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string): Promise<any> {
    return this.prisma.client.brand.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  listPublic(tenantId: string): Promise<any[]> {
    return this.prisma.client.brand.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    });
  }

  async create(tenantId: string, dto: CreateBrandDto): Promise<any> {
    const existing = await this.prisma.client.brand.findUnique({
      where: { tenantId_slug: { tenantId, slug: dto.slug } },
    });
    if (existing)
      throw new BadRequestException({
        code: 'CONFLICT',
        message: 'A brand with this slug already exists.',
      });
    return this.prisma.client.brand.create({ data: { tenantId, ...dto } });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateBrandDto,
  ): Promise<any> {
    const brand = await this.prisma.client.brand.findFirst({
      where: { id, tenantId },
    });
    if (!brand)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Brand not found.',
      });
    return this.prisma.client.brand.update({ where: { id }, data: dto });
  }
}
