export type PermissionCode = string;

export function hasAnyPermission(
  granted: readonly string[] | undefined,
  required: readonly PermissionCode[],
): boolean {
  if (required.length === 0) return true;
  const available = new Set(granted ?? []);
  return required.some((permission) => available.has(permission));
}
