import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateCategoryDto, UpdateCategoryDto } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Runs through the normal authenticated request pipeline (JWT →
 * TenantResolver → CLS already populated by the time this executes), so
 * `this.prisma.client` — the CLS-backed tenant-scoped client — is the
 * correct one to use here, not the manual `runScoped`/`.base` pattern auth
 * module needed for its bootstrap-exception call sites.
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string): Promise<any> {
    return this.prisma.client.category.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateCategoryDto): Promise<any> {
    const existing = await this.prisma.client.category.findUnique({
      where: { tenantId_slug: { tenantId, slug: dto.slug } },
    });
    if (existing)
      throw new BadRequestException({
        code: 'CONFLICT',
        message: 'A category with this slug already exists.',
      });

    if (dto.parentId) {
      const parent = await this.prisma.client.category.findFirst({
        where: { id: dto.parentId, tenantId },
      });
      if (!parent)
        throw new NotFoundException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Parent category not found.',
        });
    }

    return this.prisma.client.category.create({ data: { tenantId, ...dto } });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<any> {
    const category = await this.prisma.client.category.findFirst({
      where: { id, tenantId },
    });
    if (!category)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Category not found.',
      });
    return this.prisma.client.category.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string) {
    const category = await this.prisma.client.category.findFirst({
      where: { id, tenantId },
    });
    if (!category)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Category not found.',
      });
    await this.prisma.client.category.delete({ where: { id } });
  }
}
