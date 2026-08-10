import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * `@RequirePermissions('products.create')` — checked by RbacGuard against
 * the caller's roles *within their currently resolved tenant context*
 * (03-roles-permission-matrix.md §5: "a user with a role in Tenant A has
 * zero implicit access to Tenant B, even with the same role name"). Multiple
 * codes means the caller must hold ALL of them.
 *
 * Super Admin routes use this same decorator with the single code
 * `"platform.super_admin"` — no separate mechanism needed, since a Super
 * Admin's permissions are looked up the same way, just under their null-
 * tenant context (see permissions.ts's `super_admin` role).
 */
export const RequirePermissions = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_KEY, codes);
