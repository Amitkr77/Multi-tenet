-- Architecture correction found during M38 verification (real bug, caught
-- via testing, not code review): TenantResolverGuard must resolve which
-- tenant a request belongs to from an arbitrary Host header BEFORE any
-- tenant context exists — the exact same chicken-and-egg situation that is
-- the documented reason `tenants`/`plans`/`permissions` have NO RLS policy
-- at all ("must be resolvable before any tenant context exists"). Under
-- FORCE ROW LEVEL SECURITY, the unscoped `prisma.base` client used for this
-- lookup can NEVER see ANY row in custom_domains regardless of the query —
-- the policy's `tenant_id = current_setting('app.tenant_id', true)` check
-- evaluates to NULL (never true) with no context set, so the WHERE clause
-- never even gets a chance to matter. Proven via a real curl request with a
-- spoofed Host header against a row manually marked 'verified': it 404'd
-- (TENANT_NOT_FOUND) when it should have resolved — confirming RLS itself
-- was silently blocking the lookup, not a guard-logic bug.
--
-- Fix: custom_domains joins tenants/plans/permissions as a "must be
-- readable with zero tenant context" table — RLS removed entirely. Tenant
-- isolation for the tenant-scoped CRUD routes (DomainsService) is
-- app-layer-only from here on (explicit `where: { id, tenantId }` on every
-- query), same category and same risk profile as Tenant's own isolation
-- (TenantsService already scopes its queries the identical way, no RLS
-- backing it either). webhook_subscriptions/webhook_deliveries are
-- UNAFFECTED — they're only ever read/written at the HANDLER phase with
-- tenant context already resolved, so their RLS policies (enable_rls_phase6)
-- stay exactly as they are.
DROP POLICY IF EXISTS tenant_isolation ON "custom_domains";
ALTER TABLE "custom_domains" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "custom_domains" DISABLE ROW LEVEL SECURITY;
