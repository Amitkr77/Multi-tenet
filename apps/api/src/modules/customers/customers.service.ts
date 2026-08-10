import { Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateCustomerDto } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  omitPasswordHash,
  omitPasswordHashFromAll,
} from './strip-password-hash';

/** Tenant-facing (staff) customer management — FR-C-02/03/05. */
@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, search?: string): Promise<any> {
    const customers = await this.prisma.client.customer.findMany({
      where: {
        tenantId,
        email: search ? { contains: search, mode: 'insensitive' } : undefined,
      },
      include: { addresses: true },
      orderBy: { createdAt: 'desc' },
    });
    return omitPasswordHashFromAll(customers);
  }

  async getById(tenantId: string, id: string): Promise<any> {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id, tenantId },
      include: { addresses: true },
    });
    if (!customer)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Customer not found.',
      });
    return omitPasswordHash(customer);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<any> {
    await this.getById(tenantId, id);
    await this.prisma.client.customer.update({ where: { id }, data: dto });
    return this.getById(tenantId, id);
  }
}
