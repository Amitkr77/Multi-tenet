import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateAddressDto, UpdateAddressDto } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

/** Storefront self-service — a customer manages only their own addresses (FR-C-04). */
@Injectable()
export class CustomerAddressesService {
  constructor(private readonly prisma: PrismaService) {}

  list(customerId: string): Promise<any> {
    return this.prisma.client.customerAddress.findMany({
      where: { customerId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    tenantId: string,
    customerId: string,
    dto: CreateAddressDto,
  ): Promise<any> {
    if (dto.isDefault) {
      await this.prisma.client.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.client.customerAddress.create({
      data: { tenantId, customerId, ...dto },
    });
  }

  async update(
    customerId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<any> {
    const address = await this.prisma.client.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
    if (!address)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Address not found.',
      });

    if (dto.isDefault) {
      await this.prisma.client.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.client.customerAddress.update({
      where: { id: addressId },
      data: dto,
    });
  }

  async remove(customerId: string, addressId: string): Promise<void> {
    const address = await this.prisma.client.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
    if (!address)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Address not found.',
      });
    await this.prisma.client.customerAddress.delete({
      where: { id: addressId },
    });
  }
}
