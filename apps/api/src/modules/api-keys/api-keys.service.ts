import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import type { CreateApiKeyDto } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * `api_keys` has NO RLS policy (see that model's schema.prisma comment —
 * `ApiKeyGuard` must resolve a key with zero tenant context, structurally
 * incompatible with FORCE ROW LEVEL SECURITY, the identical bootstrap
 * problem `CustomDomain` hit in Phase 6). `prisma.client` is still used
 * here, not `prisma.base` — every method below runs at the normal HANDLER
 * phase (CLS already populated) and every query is explicitly filtered by
 * `tenantId` in its own `where` clause, so isolation for this service's own
 * CRUD comes entirely from that explicit filter, not from RLS — same
 * "prisma.client is fine, the real scoping is the WHERE clause" reasoning
 * `DomainsService` already established for `CustomDomain`.
 */
@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<any> {
    const rows = await this.prisma.client.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(omitHash);
  }

  /**
   * The plain key is returned exactly once, in this response only — never
   * again by any other endpoint (same one-time-reveal discipline as
   * `WebhookSubscriptionsService#create`'s `secret`).
   */
  async create(
    tenantId: string,
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<any> {
    const rawKey = `sat_${randomBytes(24).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPreview = rawKey.slice(-4);

    const created = await this.prisma.client.apiKey.create({
      data: { tenantId, userId, name: dto.name, keyHash, keyPreview },
    });
    return { ...omitHash(created), key: rawKey };
  }

  /** Soft-revoke — never a hard delete, same audit-trail-preserving convention as `Plan.archivedAt`. */
  async revoke(tenantId: string, id: string): Promise<void> {
    const key = await this.prisma.client.apiKey.findFirst({
      where: { id, tenantId },
    });
    if (!key) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'API key not found.',
      });
    }
    await this.prisma.client.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }
}

function omitHash<T extends { keyHash?: unknown }>(
  apiKey: T,
): Omit<T, 'keyHash'> {
  const { keyHash: _keyHash, ...rest } = apiKey;
  return rest;
}
