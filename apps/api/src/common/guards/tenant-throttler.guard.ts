import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Extends the standard ThrottlerGuard to bucket by tenant ID when one has
 * been resolved (request.tenantId populated by TenantResolverGuard, which
 * runs first in APP_GUARD order), falling back to IP for unauthenticated /
 * platform-level requests.
 *
 * Tenant-keyed buckets mean all IPs hitting the same store share a single
 * counter — a CDN or reverse-proxy forwarding many clients to one store
 * doesn't fragment into dozens of independent IP buckets, while a single
 * abusive store still gets throttled regardless of how many IPs it uses.
 *
 * The bucket limit / TTL come from the ThrottlerModule configuration in
 * app.module.ts (env-overridable via THROTTLE_LIMIT / THROTTLE_TTL_MS).
 */
@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(
    req: Record<string, unknown>,
  ): Promise<string> {
    const tenantId = (req as any).tenantId as string | undefined;
    if (tenantId) {
      return `tenant-${tenantId}`;
    }
    return `ip-${(req as any).ip ?? 'unknown'}`;
  }
}
