import type { PrismaClient, Prisma } from "@prisma/client";

/** Minimal shape of the args Prisma passes into an `$allOperations` query-extension hook. */
interface AllOperationsArgs {
  model?: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}

/**
 * Wraps every Prisma model operation in its own interactive transaction that
 * first runs `SET LOCAL app.tenant_id = '<id>'`, so Postgres RLS policies
 * (packages/database/prisma/migrations/*_enable_rls) can enforce tenant
 * isolation at the database layer — arch.md §4, this project's actual
 * isolation boundary. The Prisma-level `where: { tenantId }` scoping some
 * services add on top is defense-in-depth only; RLS is what actually matters.
 *
 * Must be built on the UN-extended base client (see base-client.ts) and call
 * `basePrisma.$transaction`, never `this.$transaction` from inside the
 * extension's own client — otherwise the transaction's queries re-enter
 * `$allOperations` and recurse/deadlock.
 *
 * `getTenantId` is a plain synchronous getter so this package stays framework
 * agnostic: apps/api supplies one backed by nestjs-cls (request-scoped),
 * apps/worker supplies one that just closes over the current job's payload.
 */
export function tenantScopedClient(
  basePrisma: PrismaClient,
  getTenantId: () => string | undefined,
) {
  return basePrisma.$extends({
    name: "tenant-scoping",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: AllOperationsArgs) {
          const tenantId = getTenantId();

          if (!model) {
            return query(args);
          }

          // No tenant context (public/unauthenticated routes, or platform-level
          // Super Admin operations that intentionally read across tenants via
          // the base client directly instead of this extension) — this used
          // to skip the transaction/SET LOCAL entirely and just run the
          // query as-is, on the theory that any tenant-owned table hit this
          // way returns zero rows under RLS (current_setting(..., true) IS
          // NULL), never all rows. A real bug caught during Phase 5
          // verification proved that assumption unsafe: under sustained load
          // against Prisma's pooled connections, a query with NO transaction
          // of its own can land on a connection where a PREVIOUS operation's
          // `SET LOCAL app.tenant_id = '<real-id>'` is still in effect
          // (observed directly — not hypothetical), which would make an
          // unscoped query silently see that tenant's rows instead of zero.
          // Now every operation gets its own transaction that explicitly
          // resets app.tenant_id to fully unset (`TO DEFAULT`) before
          // running, never trusting connection-reuse state either way.
          return basePrisma.$transaction(async (tx: Prisma.TransactionClient) => {
            if (tenantId) {
              // tenantId is a UUID already validated by Zod/the JWT/a DB lookup
              // upstream (never raw client input) — string interpolation here
              // is safe, but SET LOCAL can't take a bound parameter, so this is
              // the one place raw interpolation is unavoidable. Do not relax
              // the UUID validation that feeds this function.
              await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
            } else {
              await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id TO DEFAULT`);
            }
            return (tx as Record<string, any>)[uncapitalize(model)][operation](args);
          });
        },
      },
    },
  });
}

// Prisma's $allOperations gives PascalCase model names ("User"); the
// generated client property is camelCase ("user").
function uncapitalize(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

export type TenantScopedPrismaClient = ReturnType<typeof tenantScopedClient>;
