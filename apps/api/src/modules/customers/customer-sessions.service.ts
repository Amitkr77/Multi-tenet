import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

const REFRESH_TOKEN_BYTES = 48;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function refreshTtlMs(): number {
  const days = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);
  return days * 24 * 60 * 60 * 1000;
}

/**
 * Mirrors apps/api/src/modules/auth/sessions.service.ts exactly (same
 * rotation + reuse-detection logic), but for CustomerSession/customerId — a
 * deliberately separate table and service rather than a polymorphic Session,
 * so staff and customer auth never share a code path (see schema.prisma's
 * comment on CustomerSession).
 */
@Injectable()
export class CustomerSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    customerId: string,
    tenantId: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<string> {
    const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    await this.prisma.base.customerSession.create({
      data: {
        customerId,
        tenantId,
        refreshTokenHash: hashToken(rawToken),
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + refreshTtlMs()),
      },
    });
    return rawToken;
  }

  async revokeByToken(rawToken: string): Promise<void> {
    await this.prisma.base.customerSession.updateMany({
      where: { refreshTokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(customerId: string): Promise<void> {
    await this.prisma.base.customerSession.updateMany({
      where: { customerId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async rotate(
    rawToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{
    customerId: string;
    tenantId: string;
    newRefreshToken: string;
  }> {
    const tokenHash = hashToken(rawToken);
    const session = await this.prisma.base.customerSession.findFirst({
      where: { refreshTokenHash: tokenHash },
    });

    if (!session)
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid refresh token.',
      });

    if (session.revokedAt || session.expiresAt < new Date()) {
      if (session.revokedAt) {
        // Reuse of an already-rotated token — assume compromise, kill every session (same policy as staff auth).
        await this.revokeAll(session.customerId);
      }
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Refresh token is no longer valid.',
      });
    }

    await this.prisma.base.customerSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    const newRefreshToken = await this.create(
      session.customerId,
      session.tenantId,
      userAgent,
      ipAddress,
    );
    return {
      customerId: session.customerId,
      tenantId: session.tenantId,
      newRefreshToken,
    };
  }
}
