-- Bug fix: enable_rls_commerce mistakenly gave customer_sessions an RLS
-- policy, but CustomerSessionsService (see apps/api) mirrors
-- SessionsService's design exactly — it uses PrismaService.base (the
-- unscoped client, no SET LOCAL) throughout, matching how `sessions` (the
-- staff equivalent) was deliberately left OUT of Phase 1's RLS-protected
-- table list ("isolation is via the userId FK", schema.prisma's comment on
-- Session). customer_sessions should follow the identical pattern —
-- isolation via the customerId FK, not RLS — not the general commerce-table
-- rule the rest of enable_rls_commerce correctly applies.
DROP POLICY IF EXISTS tenant_isolation ON "customer_sessions";
ALTER TABLE "customer_sessions" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "customer_sessions" DISABLE ROW LEVEL SECURITY;
