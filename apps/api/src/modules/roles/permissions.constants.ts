// Thin re-export for import-path parity with 07-folder-module-architecture.md
// ("roles/permissions.constants.ts"). The canonical list lives in
// @saas/database (packages/database/src/permissions.ts) — it's the single
// source of truth shared with prisma/seed.ts and AuthService's tenant-
// registration bootstrap (ensureDefaultRolesForTenant), so it can't live
// here without duplicating it.
export {
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  TENANT_SYSTEM_ROLES,
} from '@saas/database';
