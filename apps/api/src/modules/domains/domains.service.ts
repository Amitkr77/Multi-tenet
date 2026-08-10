import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { AddDomainDto } from '@saas/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { DnsVerificationService } from './dns-verification.service';
import { AcmService } from './acm.service';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * `custom_domains` is RLS-protected (standard tenant policy) — every method
 * here runs at the normal HANDLER phase (called from DomainsController's
 * route methods), so `prisma.client` is correctly tenant-scoped, same as
 * every other tenant CRUD service in this codebase (CouponsService, etc.).
 *
 * `domain`'s global uniqueness (one hostname can only ever point at one
 * tenant) is NOT pre-checked via a cross-tenant read — `custom_domains` has
 * FORCE ROW LEVEL SECURITY, so even the unscoped `prisma.base` client
 * cannot see another tenant's row (the policy's `tenant_id =
 * current_setting(...)` comparison is NULL, never true, with no context
 * set), making a cross-tenant existence pre-check structurally impossible,
 * not just inconvenient. Postgres's own unique index still enforces the
 * constraint at INSERT time regardless of RLS visibility, though (a
 * documented RLS side-channel, not a bug) — so `create` below just attempts
 * the insert and catches the resulting P2002, same pattern as
 * `ReviewsService#create`'s `ALREADY_REVIEWED` handling.
 */
@Injectable()
export class DomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dnsVerification: DnsVerificationService,
    private readonly acm: AcmService,
  ) {}

  list(tenantId: string): Promise<any> {
    return this.prisma.client.customDomain.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, dto: AddDomainDto): Promise<any> {
    const domain = dto.domain.toLowerCase();
    const verificationToken = randomBytes(16).toString('hex');
    try {
      const created = await this.prisma.client.customDomain.create({
        data: { tenantId, domain, verificationToken },
      });
      return this.toResponse(created);
    } catch (err: any) {
      if (err?.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'This domain is already registered to a store.',
        });
      }
      throw err;
    }
  }

  /**
   * Runs the real DNS TXT check. A negative result is an entirely ordinary
   * "not configured yet" outcome (DNS propagation can take minutes to
   * hours) — it leaves `status` at `pending_verification` and returns a 400
   * so the tenant can simply retry, rather than persisting a `failed`
   * status that would need its own separate retry affordance. `failed` is
   * reserved for a distinct, not-yet-built escalation path (e.g. an
   * automated re-check giving up after N days) — never set by this method.
   */
  async verify(tenantId: string, id: string): Promise<any> {
    const domain = await this.getOr404(tenantId, id);
    if (domain.status === 'verified') return this.toResponse(domain);

    const verified = await this.dnsVerification.verify(
      domain.domain,
      domain.verificationToken,
    );
    if (!verified) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `DNS TXT record not found yet at ${this.dnsVerification.recordNameFor(domain.domain)}. DNS changes can take time to propagate — try again shortly.`,
      });
    }

    await this.acm.provisionCertificate(domain.domain);
    const updated = await this.prisma.client.customDomain.update({
      where: { id },
      data: { status: 'verified', verifiedAt: new Date() },
    });
    return this.toResponse(updated);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.getOr404(tenantId, id);
    await this.prisma.client.customDomain.delete({ where: { id } });
  }

  private async getOr404(tenantId: string, id: string): Promise<any> {
    const domain = await this.prisma.client.customDomain.findFirst({
      where: { id, tenantId },
    });
    if (!domain) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Custom domain not found.',
      });
    }
    return domain;
  }

  private toResponse(domain: any) {
    return {
      ...domain,
      dnsInstructions: {
        recordType: 'TXT',
        recordName: this.dnsVerification.recordNameFor(domain.domain),
        value: domain.verificationToken,
      },
    };
  }
}
