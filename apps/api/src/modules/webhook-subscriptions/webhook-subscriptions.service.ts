import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type {
  CreateWebhookSubscriptionDto,
  UpdateWebhookSubscriptionDto,
} from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * `webhook_subscriptions`/`webhook_deliveries` are RLS-protected (standard
 * tenant policy) — every method here runs at the normal HANDLER phase
 * (CLS already populated), so `prisma.client` is correctly tenant-scoped,
 * same as every other tenant CRUD service in this codebase.
 */
@Injectable()
export class WebhookSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<any> {
    const rows = await this.prisma.client.webhookSubscription.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(omitSecret);
  }

  /**
   * `secret` is deliberately included in THIS response only (create) — the
   * one moment the tenant can see it, same "shown once, never again"
   * discipline a real API-key issuance flow would follow. It's never
   * returned by `list`/`update` afterward.
   */
  async create(
    tenantId: string,
    dto: CreateWebhookSubscriptionDto,
  ): Promise<any> {
    const secret = randomBytes(24).toString('hex');
    return this.prisma.client.webhookSubscription.create({
      data: {
        tenantId,
        url: dto.url,
        secret,
        eventTypes: dto.eventTypes,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateWebhookSubscriptionDto,
  ): Promise<any> {
    await this.getOr404(tenantId, id);
    const updated = await this.prisma.client.webhookSubscription.update({
      where: { id },
      data: dto,
    });
    return omitSecret(updated);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.getOr404(tenantId, id);
    await this.prisma.client.webhookSubscription.delete({ where: { id } });
  }

  async listDeliveries(tenantId: string, subscriptionId: string): Promise<any> {
    await this.getOr404(tenantId, subscriptionId);
    return this.prisma.client.webhookDelivery.findMany({
      where: { tenantId, subscriptionId },
      orderBy: { createdAt: 'desc' },
      take: 100, // a delivery log, not an unbounded export — same "recent activity view" scope as most dashboard tables in this app
    });
  }

  private async getOr404(tenantId: string, id: string): Promise<any> {
    const subscription = await this.prisma.client.webhookSubscription.findFirst(
      { where: { id, tenantId } },
    );
    if (!subscription) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Webhook subscription not found.',
      });
    }
    return subscription;
  }
}

function omitSecret<T extends { secret?: unknown }>(
  subscription: T,
): Omit<T, 'secret'> {
  const { secret: _secret, ...rest } = subscription;
  return rest;
}
