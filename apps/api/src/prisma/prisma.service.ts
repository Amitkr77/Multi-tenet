import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { PrismaClient, Prisma } from '@saas/database';
import {
  createBasePrismaClient,
  tenantScopedClient,
  type TenantScopedPrismaClient,
} from '@saas/database';
import { CLS_KEY_TENANT_ID } from './tenant-context';

/**
 * Singleton (not request-scoped — the tenant-scoping extension reads CLS at
 * query time via `getTenantId()`, so one shared extended client instance is
 * enough; request-scoped providers would instantiate this across the whole
 * DI subtree per request for no benefit here).
 *
 * `client` — the RLS-aware, tenant-scoped client. Use this for everything
 * that touches tenant-owned tables (users, roles, user_roles, audit_logs).
 * `base` — the un-extended client, connected as `app_user` same as `client`
 * (still subject to RLS — `app_user` is never a superuser) but WITHOUT the
 * per-operation `SET LOCAL`. Only reach for this when you are deliberately
 * managing your own transaction + SET LOCAL — e.g. AuthService#register's
 * bootstrap exception (the tenant doesn't exist yet when the transaction
 * starts) — never as a shortcut to "skip" tenant scoping elsewhere.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly base: PrismaClient = createBasePrismaClient(
    process.env.DATABASE_URL_APP,
  );
  readonly client: TenantScopedPrismaClient;

  constructor(private readonly cls: ClsService) {
    this.client = tenantScopedClient(this.base, () =>
      this.cls.get(CLS_KEY_TENANT_ID),
    );
  }

  async onModuleDestroy() {
    await this.base.$disconnect();
  }

  /**
   * For the handful of flows that must pick their OWN tenant scope instead of
   * inheriting it from CLS/request context — AuthService#register (the
   * tenant doesn't exist yet when the transaction starts) and
   * AuthService#login (the tenant being authenticated against may come from
   * the request body's `tenantId`, not the Host-header-resolved one the CLS
   * interceptor already captured). `tenantId` must already be a validated
   * UUID from Zod or a prior DB lookup — see tenant-extension.ts's identical
   * safety note on raw interpolation into SET LOCAL.
   */
  async runScoped<T>(
    tenantId: string | null,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.base.$transaction(async (tx) => {
      // Always explicitly set app.tenant_id — including the null-tenant
      // (platform Super Admin) case, which used to just skip this entirely.
      // Real bug caught during Phase 5 verification: `SET LOCAL` is
      // supposed to be strictly transaction-scoped and reset automatically
      // at commit, but under sustained load against Prisma's pooled
      // connections this codebase observed `runScoped(null, ...)` silently
      // inheriting a PREVIOUS transaction's real tenant_id on a reused
      // connection — breaking the RLS null-tenant carve-out
      // (`tenant_id IS NULL AND current_setting(...) IS NULL`) and making
      // Super Admin login intermittently (and then, once triggered,
      // consistently) fail with a false "Invalid email or password."
      // `TO DEFAULT` resets a custom GUC to fully unset (current_setting(
      // ..., true) returns NULL again), never trusting connection-reuse
      // state either way.
      if (tenantId) {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      } else {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id TO DEFAULT`);
      }
      return fn(tx);
    });
  }
}
