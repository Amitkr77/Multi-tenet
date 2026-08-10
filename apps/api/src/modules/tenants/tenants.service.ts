import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  QUEUE_NAMES,
  COMPLIANCE_JOB_NAMES,
  type UpdateTenantDto,
  type UpdateTenantStatusDto,
  type PlanOverrideDto,
  type GenerateExportJob,
} from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    @InjectQueue(QUEUE_NAMES.dataExport)
    private readonly dataExportQueue: Queue,
  ) {}

  /** `tenants` has no RLS policy (it IS the tenant) — base client is correct here. */
  async getById(tenantId: string) {
    const tenant = await this.prisma.base.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant)
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Tenant not found.',
      });
    return tenant;
  }

  async updateOwnProfile(tenantId: string, dto: UpdateTenantDto) {
    return this.prisma.base.tenant.update({
      where: { id: tenantId },
      data: dto,
    });
  }

  // --- Super Admin ---

  async listAll(page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.prisma.base.tenant.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.base.tenant.count(),
    ]);
    return { data: items, meta: { total, page, limit } };
  }

  async updateStatus(
    tenantId: string,
    dto: UpdateTenantStatusDto,
    actorUserId: string,
  ) {
    const tenant = await this.getById(tenantId);
    const enteringOffboarded =
      dto.status === 'offboarded' && tenant.status !== 'offboarded';
    const updated = await this.prisma.base.tenant.update({
      where: { id: tenantId },
      data: {
        status: dto.status,
        // FR-AU-03/NFR-CP-02 — starts the retention clock
        // DataRetentionProcessor checks against, same convention as
        // pastDueSince driving DunningProcessor's grace period.
        offboardedAt: enteringOffboarded ? new Date() : undefined,
      },
    });

    await this.auditLog.log({
      tenantId,
      actorUserId,
      action: 'tenant.status_change',
      metadata: { from: tenant.status, to: dto.status, reason: dto.reason },
    });

    // Auto-triggered export — same pipeline the self-service
    // `POST /tenants/me/export` route below uses, just system-initiated
    // rather than tenant-initiated. `actorUserId` here is the SUPER ADMIN
    // who offboarded the tenant, not a member of the tenant itself —
    // recorded as `requestedByUserId` for audit-trail completeness even
    // though it's a platform user, not a tenant one (no FK enforced on
    // that column for exactly this reason).
    if (enteringOffboarded) {
      await this.requestExport(tenantId, actorUserId);
    }

    return updated;
  }

  /**
   * FR-AU-03 / NFR-CP-01. Uses `runScoped`, not `prisma.client` — this is
   * called both from a real tenant-owner request (CLS already populated)
   * AND from `updateStatus` above (a Super Admin caller with no tenant
   * context of its own) — same "no tenant context to satisfy the INSERT's
   * WITH CHECK clause without one" reasoning as `createPlanOverride`.
   */
  async requestExport(tenantId: string, actorUserId: string): Promise<any> {
    await this.getById(tenantId); // 404 if the tenant itself doesn't exist
    const request = await this.prisma.runScoped(tenantId, (tx) =>
      tx.dataExportRequest.create({
        data: { tenantId, requestedByUserId: actorUserId },
      }),
    );
    const job: GenerateExportJob = {
      tenantId,
      exportRequestId: request.id,
    };
    await this.dataExportQueue.add(COMPLIANCE_JOB_NAMES.generateExport, job);
    return request;
  }

  async listExportRequests(tenantId: string): Promise<any[]> {
    return this.prisma.runScoped(tenantId, (tx) =>
      tx.dataExportRequest.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async listAuditLogs(tenantId: string): Promise<any[]> {
    await this.getById(tenantId); // 404 if the tenant itself doesn't exist
    return this.auditLog.listForTenant(tenantId);
  }

  /**
   * FR-P-06 — Phase 5 stub. Full implementation issues a short-lived (15
   * min), non-renewable token scoped to the tenant's Owner role and writes an
   * audit log entry on issuance (see 06-api-specification.md's endpoint
   * note). Not implemented yet — no impersonation session storage exists.
   */
  async impersonate(_tenantId: string, _actorUserId: string): Promise<never> {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message:
        'Tenant impersonation is not yet implemented (planned, not in Phase 1).',
    });
  }

  /**
   * FR-P-08 — replaces the former 501 stub now that TenantPlanOverride
   * exists (Phase 5). Uses `runScoped`, NOT `prisma.base` directly —
   * `tenant_plan_overrides` IS RLS-protected (PlanLimitGuard must read it
   * through the normal tenant-scoped client so a tenant transparently sees
   * only its own override — see that table's schema.prisma comment), and
   * the Super Admin caller has no tenant context of its own to satisfy the
   * INSERT's WITH CHECK clause without one.
   */
  async createPlanOverride(
    tenantId: string,
    dto: PlanOverrideDto,
    actorUserId: string,
  ) {
    await this.getById(tenantId); // 404 if the tenant itself doesn't exist
    const override = await this.prisma.runScoped(tenantId, (tx) =>
      tx.tenantPlanOverride.create({
        data: {
          tenantId,
          metric: dto.metric,
          overrideValue: dto.overrideValue,
          reason: dto.reason,
          grantedByUserId: actorUserId,
          expiresAt: dto.expiresAt,
        },
      }),
    );
    await this.auditLog.log({
      tenantId,
      actorUserId,
      action: 'tenant.plan_override_granted',
      metadata: {
        metric: dto.metric,
        overrideValue: dto.overrideValue,
        reason: dto.reason,
        expiresAt: dto.expiresAt,
      },
    });
    return override;
  }

  async listPlanOverrides(tenantId: string): Promise<any[]> {
    await this.getById(tenantId);
    return this.prisma.runScoped(tenantId, (tx) =>
      tx.tenantPlanOverride.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }
}
