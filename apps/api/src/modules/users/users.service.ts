import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import {
  QUEUE_NAMES,
  EMAIL_JOB_NAMES,
  type InviteUserDto,
  type UpdateUserDto,
  type AcceptInviteDto,
} from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    @InjectQueue(QUEUE_NAMES.email) private readonly emailQueue: Queue,
  ) {}

  async list(tenantId: string) {
    return this.prisma.runScoped(tenantId, (tx) =>
      tx.user.findMany({
        where: { tenantId },
        select: {
          id: true,
          email: true,
          isActive: true,
          emailVerifiedAt: true,
          createdAt: true,
          userRoles: { select: { role: { select: { id: true, name: true } } } },
        },
      }),
    );
  }

  async invite(
    tenantId: string,
    tenantName: string,
    dto: InviteUserDto,
    actorUserId: string,
  ) {
    const { user, rawToken } = await this.prisma.runScoped(
      tenantId,
      async (tx) => {
        const existing = await tx.user.findUnique({
          where: { tenantId_email: { tenantId, email: dto.email } },
        });
        if (existing)
          throw new BadRequestException({
            code: 'CONFLICT',
            message: 'This email is already part of the team.',
          });

        const role = await tx.role.findFirst({
          where: { id: dto.roleId, tenantId },
        });
        if (!role)
          throw new NotFoundException({
            code: 'RESOURCE_NOT_FOUND',
            message: 'Role not found in this tenant.',
          });

        const created = await tx.user.create({
          data: { tenantId, email: dto.email, isActive: false },
        });
        await tx.userRole.create({
          data: { userId: created.id, roleId: role.id, tenantId },
        });

        const raw = randomBytes(32).toString('hex');
        await tx.verificationToken.create({
          data: {
            userId: created.id,
            tenantId,
            type: 'staff_invite',
            tokenHash: hashOpaqueToken(raw),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });

        return { user: created, rawToken: raw };
      },
    );

    await this.emailQueue.add(EMAIL_JOB_NAMES.sendStaffInviteEmail, {
      toEmail: user.email,
      tenantName,
      acceptUrl: `${process.env.WEB_APP_URL}/accept-invite?token=${rawToken}`,
    });

    await this.auditLog.log({
      tenantId,
      actorUserId,
      action: 'user.invite',
      metadata: { email: dto.email, roleId: dto.roleId },
    });
    return { id: user.id, email: user.email };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const tokenHash = hashOpaqueToken(dto.token);
    const record = await this.prisma.base.verificationToken.findFirst({
      where: {
        tokenHash,
        type: 'staff_invite',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid or expired invite token.',
      });

    const passwordHash = await argon2.hash(dto.password);
    await this.prisma.runScoped(record.tenantId, (tx) =>
      tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, isActive: true, emailVerifiedAt: new Date() },
      }),
    );
    await this.prisma.base.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
  }

  async update(
    tenantId: string,
    userId: string,
    dto: UpdateUserDto,
    actorUserId: string,
  ) {
    if (userId === actorUserId && dto.isActive === false) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You cannot deactivate your own account.',
      });
    }

    return this.prisma.runScoped(tenantId, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, tenantId } });
      if (!user)
        throw new NotFoundException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'User not found in this tenant.',
        });

      if (dto.roleId) {
        const role = await tx.role.findFirst({
          where: { id: dto.roleId, tenantId },
        });
        if (!role)
          throw new NotFoundException({
            code: 'RESOURCE_NOT_FOUND',
            message: 'Role not found in this tenant.',
          });
        await tx.userRole.deleteMany({ where: { userId, tenantId } });
        await tx.userRole.create({
          data: { userId, roleId: role.id, tenantId },
        });
      }

      const updated =
        dto.isActive === undefined
          ? user
          : await tx.user.update({
              where: { id: userId },
              data: { isActive: dto.isActive },
            });

      await this.auditLog.log({
        tenantId,
        actorUserId,
        action: 'user.update',
        metadata: dto,
      });
      return updated;
    });
  }

  /** FR-U-05: "deactivate or remove" — implemented as deactivation (soft), preserving order/audit history integrity. */
  async remove(tenantId: string, userId: string, actorUserId: string) {
    return this.update(tenantId, userId, { isActive: false }, actorUserId);
  }
}
