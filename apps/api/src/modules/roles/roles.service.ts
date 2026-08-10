import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PERMISSIONS } from '@saas/database';
import type { CreateRoleDto, UpdateRoleDto } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  listPermissionCatalogue() {
    return PERMISSIONS;
  }

  async list(tenantId: string) {
    return this.prisma.runScoped(tenantId, (tx) =>
      tx.role.findMany({
        where: { tenantId },
        include: { rolePermissions: { include: { permission: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  async create(tenantId: string, dto: CreateRoleDto, actorUserId: string) {
    const role = await this.prisma.runScoped(tenantId, async (tx) => {
      const existing = await tx.role.findUnique({
        where: { tenantId_name: { tenantId, name: dto.name } },
      });
      if (existing)
        throw new BadRequestException({
          code: 'CONFLICT',
          message: 'A role with this name already exists.',
        });

      const permissions = await tx.permission.findMany({
        where: { code: { in: dto.permissionCodes } },
      });
      if (permissions.length !== dto.permissionCodes.length) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'One or more permission codes are invalid.',
        });
      }

      const created = await tx.role.create({
        data: { tenantId, name: dto.name, isSystemRole: false },
      });
      await tx.rolePermission.createMany({
        data: permissions.map((p: { id: string }) => ({
          roleId: created.id,
          permissionId: p.id,
        })),
      });
      return created;
    });

    await this.auditLog.log({
      tenantId,
      actorUserId,
      action: 'role.create',
      metadata: { name: dto.name, roleId: role.id },
    });
    return role;
  }

  async update(
    tenantId: string,
    roleId: string,
    dto: UpdateRoleDto,
    actorUserId: string,
  ) {
    const updated = await this.prisma.runScoped(tenantId, async (tx) => {
      const role = await tx.role.findFirst({ where: { id: roleId, tenantId } });
      if (!role)
        throw new NotFoundException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Role not found in this tenant.',
        });

      if (dto.name)
        await tx.role.update({
          where: { id: roleId },
          data: { name: dto.name },
        });

      if (dto.permissionCodes) {
        const permissions = await tx.permission.findMany({
          where: { code: { in: dto.permissionCodes } },
        });
        if (permissions.length !== dto.permissionCodes.length) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'One or more permission codes are invalid.',
          });
        }
        await tx.rolePermission.deleteMany({ where: { roleId } });
        await tx.rolePermission.createMany({
          data: permissions.map((p: { id: string }) => ({
            roleId,
            permissionId: p.id,
          })),
        });
      }

      return tx.role.findUniqueOrThrow({ where: { id: roleId } });
    });

    await this.auditLog.log({
      tenantId,
      actorUserId,
      action: 'role.update',
      metadata: { roleId, ...dto },
    });
    return updated;
  }

  async remove(tenantId: string, roleId: string, actorUserId: string) {
    await this.prisma.runScoped(tenantId, async (tx) => {
      const role = await tx.role.findFirst({ where: { id: roleId, tenantId } });
      if (!role)
        throw new NotFoundException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Role not found in this tenant.',
        });
      if (role.isSystemRole) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message:
            'System roles (Owner/Admin/Manager/Staff) cannot be deleted.',
        });
      }
      await tx.role.delete({ where: { id: roleId } });
    });

    await this.auditLog.log({
      tenantId,
      actorUserId,
      action: 'role.delete',
      metadata: { roleId },
    });
  }
}
