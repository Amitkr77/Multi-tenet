/**
 * CLS keys used to carry request-scoped context (set by
 * common/interceptors/tenant-context.interceptor.ts) down to
 * PrismaService's tenant-scoping extension (see prisma.service.ts) and
 * anywhere else in the request that needs to know "whose data is this."
 */
export const CLS_KEY_TENANT_ID = 'tenantId';
export const CLS_KEY_USER_ID = 'userId';
export const CLS_KEY_REQUEST_ID = 'requestId';
