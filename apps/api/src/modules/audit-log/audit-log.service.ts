import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * FR-AU-01: sensitive actions (role changes, tenant status changes, refunds,
 * plan changes, data exports) logged with actor/timestamp/tenant context.
 * `audit_logs` is RLS-protected (tenant_id), so writes go through
 * `runScoped` — `tenantId: null` correctly targets platform-wide entries
 * (e.g. Super Admin actions) per the same RLS policy clause that lets the
 * null-tenant Super Admin see their own rows.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    tenantId: string | null;
    actorUserId: string | null;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.runScoped(params.tenantId, (tx) =>
      tx.auditLog.create({
        data: {
          tenantId: params.tenantId,
          actorUserId: params.actorUserId,
          action: params.action,
          metadata: (params.metadata ?? {}) as any,
        },
      }),
    );
  }

  async listForTenant(tenantId: string): Promise<any[]> {
    return this.prisma.runScoped(tenantId, (tx) =>
      tx.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    );
  }
}
