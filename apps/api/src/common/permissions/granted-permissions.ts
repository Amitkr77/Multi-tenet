import { PrismaService } from '../../prisma/prisma.service';

/**
 * Resolves the full set of permission codes a user holds *within a specific
 * tenant context* (null tenantId = the platform Super Admin's own role).
 * Shared by AuthService#buildMeResponse (returned to the client for UI
 * gating) and RbacGuard (the actual server-side enforcement — client-side
 * checks are convenience only, per 03-roles-permission-matrix.md §5).
 */
export async function resolveGrantedPermissions(
  prisma: PrismaService,
  userId: string,
  tenantId: string | null,
): Promise<{ roles: string[]; permissions: string[] }> {
  const userRoles = await prisma.runScoped(tenantId, (tx) =>
    tx.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: true } } },
        },
      },
    }),
  );

  const roles = userRoles.map((ur: any) => ur.role.name as string);
  const permissions = Array.from(
    new Set(
      userRoles.flatMap((ur: any) =>
        ur.role.rolePermissions.map((rp: any) => rp.permission.code as string),
      ),
    ),
  );
  return { roles, permissions };
}
