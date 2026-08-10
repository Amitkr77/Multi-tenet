/**
 * Prisma's `omit` query option needs a preview feature flag not enabled in
 * this schema (would require a migration-adjacent generator config change
 * for one field) — simplest fix that needs no schema change: strip it after
 * the query instead. Used everywhere a Customer row is returned to a
 * client, tenant-facing or storefront-facing alike; `passwordHash` must
 * never leave the API process.
 */
export function omitPasswordHash<T extends { passwordHash?: unknown }>(
  customer: T,
): Omit<T, 'passwordHash'> {
  const { passwordHash: _passwordHash, ...rest } = customer;
  return rest;
}

export function omitPasswordHashFromAll<T extends { passwordHash?: unknown }>(
  customers: T[],
): Array<Omit<T, 'passwordHash'>> {
  return customers.map(omitPasswordHash);
}
