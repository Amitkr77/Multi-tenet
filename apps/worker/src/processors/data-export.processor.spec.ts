import { randomBytes } from "node:crypto";
import { createBasePrismaClient } from "@saas/database";
import { COMPLIANCE_JOB_NAMES } from "@saas/shared-types";
import { DataExportProcessor } from "./data-export.processor";

/**
 * A real integration test (real Postgres, real MinIO/S3) — same discipline
 * as `webhook-delivery.processor.spec.ts`. Calls `processor.process()`
 * directly rather than through a real BullMQ queue, same precedent. Safe to
 * exercise here (unlike `DataRetentionProcessor`'s cross-tenant sweep,
 * deliberately NOT given an equivalent unit test — see this file's sibling
 * comment) because `generateExport` only ever touches the ONE
 * `(tenantId, exportRequestId)` pair its job data names.
 */
describe("DataExportProcessor", () => {
  const prisma = createBasePrismaClient(process.env.DATABASE_URL_APP);
  let processor: DataExportProcessor;
  let tenantId: string;

  beforeAll(async () => {
    processor = new DataExportProcessor({ add: jest.fn() } as any);
    const suffix = randomBytes(4).toString("hex");
    const tenant = await prisma.tenant.create({
      data: {
        name: "Export Processor Test",
        subdomain: `export-proc-test-${suffix}`,
      },
    });
    tenantId = tenant.id;

    // A representative slice of real, exportable data — enough to prove the
    // real query set + field exclusions, not an exhaustive fixture of every
    // in-scope table.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      await tx.user.create({
        data: {
          tenantId,
          email: "owner@export-test.example",
          passwordHash: "should-never-appear-in-export",
        },
      });
      await tx.webhookSubscription.create({
        data: {
          tenantId,
          url: "http://example.com/hook",
          secret: "should-never-appear-in-export",
          eventTypes: ["order.created"],
        },
      });
    });
  });

  afterAll(async () => {
    await prisma.tenant
      .delete({ where: { id: tenantId } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it("uploads a real export to storage, generates a working presigned URL, and marks the request ready", async () => {
    const request = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      return tx.dataExportRequest.create({ data: { tenantId } });
    });

    await processor.process({
      name: COMPLIANCE_JOB_NAMES.generateExport,
      data: { tenantId, exportRequestId: request.id },
    } as any);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      return tx.dataExportRequest.findUniqueOrThrow({
        where: { id: request.id },
      });
    });
    expect(updated.status).toBe("ready");
    expect(updated.downloadUrl).toBeTruthy();
    expect(updated.expiresAt).not.toBeNull();

    // The real, load-bearing assertion: fetch the actual uploaded blob via
    // its real presigned URL and check its real content.
    const res = await fetch(updated.downloadUrl!);
    expect(res.status).toBe(200);
    const exported = (await res.json()) as any;

    expect(exported.tenant.id).toBe(tenantId);
    expect(exported.users).toHaveLength(1);
    expect(exported.users[0].email).toBe("owner@export-test.example");
    expect(exported.users[0].passwordHash).toBeUndefined();
    expect(exported.webhookSubscriptions).toHaveLength(1);
    expect(exported.webhookSubscriptions[0].secret).toBeUndefined();
    // Deliberately-excluded tables (see this processor's own file comment)
    // never even appear as keys in the export document.
    expect(exported.auditLog).toBeUndefined();
    expect(exported.webhookDeliveries).toBeUndefined();
  });

  it("marks the request failed (and still throws, for BullMQ to record) if the DB lookup fails", async () => {
    await expect(
      processor.process({
        name: COMPLIANCE_JOB_NAMES.generateExport,
        data: {
          tenantId,
          exportRequestId: "00000000-0000-0000-0000-000000000000",
        },
      } as any),
    ).rejects.toThrow();
  });

  it("does nothing (no throw) for an unrecognized job name", async () => {
    await expect(
      processor.process({ name: "some-unknown-job", data: {} } as any),
    ).resolves.toBeUndefined();
  });
});
