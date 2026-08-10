import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Runs on EVERY request (public and private alike — subdomain resolution
 * doesn't depend on being authenticated), before JwtAuthGuard (see
 * app.module.ts's APP_GUARD order). Resolves which tenant this request is
 * for, purely from the `Host` header, and attaches `request.tenantId`.
 *
 * Queries `Tenant` via `PrismaService.base` (the un-extended client) — the
 * `tenants` table has no RLS policy (Section 4: it IS the tenant, there's
 * nothing to scope it by), so this lookup needs no tenant context of its own
 * — a deliberate chicken-and-egg resolution, not an oversight.
 *
 * Dev-only escape hatch: `X-Tenant-Subdomain` header, since local dev has no
 * real wildcard-DNS subdomains to hit. Guarded behind `NODE_ENV !==
 * 'production'` so it can never be reachable in a prod build.
 *
 * If no subdomain signal is present at all (bare `localhost`, no dev header),
 * this guard resolves nothing and does NOT throw — many Phase-1 routes are
 * platform-level (Super Admin login, `/plans`) and legitimately have no
 * tenant. It only throws when a subdomain candidate WAS given but doesn't
 * resolve to a valid, active tenant.
 *
 * Phase 6 — custom-domain fallback: when the `Host` doesn't match
 * `*.${APP_BASE_DOMAIN}` at all (so `resolveCandidateSubdomain` returns
 * null), the raw host is tried against `CustomDomain.domain` (only a
 * `verified` row counts) before giving up. Deliberately does NOT throw
 * `TENANT_NOT_FOUND` when that lookup also comes up empty — unlike an
 * `*.${APP_BASE_DOMAIN}` subdomain, which unambiguously IS a tenant-facing
 * request, an arbitrary external host has no such guarantee (could be the
 * platform's own bare domain, a health-check probe, anything) — same "only
 * throw when the signal was unambiguously meant for us" discipline the
 * existing subdomain branch already follows.
 */
@Injectable()
export class TenantResolverGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const subdomain = this.resolveCandidateSubdomain(request);

    if (!subdomain) {
      const tenant = await this.resolveViaCustomDomain(request);
      if (!tenant) {
        request.tenantId = null;
        return true;
      }
      this.assertNotSuspended(tenant);
      request.tenantId = tenant.id;
      return true;
    }

    const tenant = await this.prisma.base.tenant.findUnique({
      where: { subdomain },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: `No tenant found for subdomain '${subdomain}'.`,
      });
    }
    this.assertNotSuspended(tenant);

    request.tenantId = tenant.id;
    return true;
  }

  private assertNotSuspended(tenant: { status: string }): void {
    if (tenant.status === 'suspended' || tenant.status === 'offboarded') {
      throw new ForbiddenException({
        code: 'TENANT_SUSPENDED',
        message: 'This store is temporarily unavailable.',
      });
    }
  }

  /**
   * `custom_domains` IS RLS-protected (unlike `tenants`), but this lookup
   * runs on `prisma.base` with no tenant context anyway — the exact same
   * chicken-and-egg situation as the subdomain lookup above, and correct for
   * the same reason: resolving WHICH tenant a request belongs to has to
   * happen before any tenant context can exist. The `verified` filter is
   * part of the WHERE clause, not a post-check, so an unverified/failed
   * domain resolves nothing (never partially trusts a domain someone merely
   * claimed but never proved ownership of).
   */
  private async resolveViaCustomDomain(
    request: any,
  ): Promise<{ id: string; status: string } | null> {
    const host = String(request.headers.host ?? '').split(':')[0];
    if (!host) return null;

    const customDomain = await this.prisma.base.customDomain.findFirst({
      where: { domain: host, status: 'verified' },
      include: { tenant: true },
    });
    return customDomain?.tenant ?? null;
  }

  private resolveCandidateSubdomain(request: any): string | null {
    if (process.env.NODE_ENV !== 'production') {
      const devHeader = request.headers['x-tenant-subdomain'];
      if (devHeader) return String(devHeader);
    }

    const host = String(request.headers.host ?? '').split(':')[0];
    const baseDomain = process.env.APP_BASE_DOMAIN ?? 'yourapp.local';
    if (host === baseDomain || !host.endsWith(`.${baseDomain}`)) return null;

    const prefix = host.slice(0, -(baseDomain.length + 1));
    if (!prefix || prefix === 'www') return null;
    return prefix;
  }
}
