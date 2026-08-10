import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

const REFRESH_TOKEN_BYTES = 48;

function hashToken(token: string): string {
  // Refresh tokens are high-entropy random bytes, not low-entropy secrets
  // like passwords — a fast hash (sha256) is appropriate here, unlike
  // Argon2 for password storage. This is a lookup key, not a guarding hash.
  return createHash('sha256').update(token).digest('hex');
}

function refreshTtlMs(): number {
  const days = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);
  return days * 24 * 60 * 60 * 1000;
}

/**
 * Session rows back both per-device revoke and logout-all-devices (FR-A-07),
 * and reuse-detection on refresh-token rotation. `sessions` has no RLS policy
 * of its own (isolation is via the userId FK, per the ERD) — this service
 * always uses PrismaService.base. `tenantId` is stored as a denormalized,
 * unenforced convenience column (see schema.prisma's comment on it): a
 * refresh token is presented *before* any tenant context exists, so
 * AuthService#refresh needs somewhere to read "which tenant" from without
 * already being able to query the (RLS-protected) `users` table.
 */
@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Issues a new refresh token + Session row. Returns the raw (unhashed) token. */
  async create(
    userId: string,
    tenantId: string | null,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<string> {
    const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    await this.prisma.base.session.create({
      data: {
        userId,
        tenantId,
        refreshTokenHash: hashToken(rawToken),
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + refreshTtlMs()),
      },
    });
    return rawToken;
  }

  async list(userId: string) {
    return this.prisma.base.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
    });
  }

  async revoke(userId: string, sessionId: string): Promise<void> {
    await this.prisma.base.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.base.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Validates a presented refresh token and rotates it (old session revoked,
   * new one issued). If the token doesn't match any *active* session but DOES
   * match a session that was already revoked, that's refresh-token reuse — a
   * strong signal of token theft — and the correct response is to revoke
   * every session for that user, not just reject this one request.
   */
  async rotate(
    rawToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{
    userId: string;
    tenantId: string | null;
    newRefreshToken: string;
  }> {
    const tokenHash = hashToken(rawToken);
    const session = await this.prisma.base.session.findFirst({
      where: { refreshTokenHash: tokenHash },
    });

    if (!session)
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid refresh token.',
      });

    if (session.revokedAt || session.expiresAt < new Date()) {
      if (session.revokedAt) {
        // Reuse of a rotated/revoked token — assume compromise, kill every session.
        await this.revokeAll(session.userId);
      }
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Refresh token is no longer valid.',
      });
    }

    await this.prisma.base.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    const newRefreshToken = await this.create(
      session.userId,
      session.tenantId,
      userAgent,
      ipAddress,
    );
    return {
      userId: session.userId,
      tenantId: session.tenantId,
      newRefreshToken,
    };
  }
}
