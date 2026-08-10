import { PrismaClient } from "@prisma/client";

/**
 * The un-extended Prisma client. Never query tenant-owned tables through this
 * directly from application code — it has no RLS session variable set, and
 * since the app connects as `app_user` (NOSUPERUSER NOBYPASSRLS, see the
 * enable_rls migration), every tenant-owned-table query through this client
 * returns zero rows rather than all rows (current_setting(..., true) is NULL
 * when unset, and `tenant_id = NULL` is never true). It exists so the tenant
 * extension (see tenant-extension.ts) has something un-extended to build its
 * `$transaction` calls on top of — extending a client and then having the
 * extension call `this.$transaction` instead of the base client's would
 * re-enter `$allOperations` recursively and deadlock.
 */
export function createBasePrismaClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient(
    databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined,
  );
}
