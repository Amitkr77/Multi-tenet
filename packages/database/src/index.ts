export * from "@prisma/client";
export { createBasePrismaClient } from "./base-client";
export { tenantScopedClient, type TenantScopedPrismaClient } from "./tenant-extension";
export * from "./permissions";
export * from "./bootstrap";
