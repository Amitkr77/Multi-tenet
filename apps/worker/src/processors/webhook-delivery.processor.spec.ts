import * as http from "node:http";
import { createHmac, randomBytes } from "node:crypto";
import { createBasePrismaClient } from "@saas/database";
import { WEBHOOK_DELIVERY_JOB_NAMES } from "@saas/shared-types";
import { WebhookDeliveryProcessor } from "./webhook-delivery.processor";

/**
 * A real integration test, not a mocked unit test — same discipline as this
 * whole codebase's e2e suites (real Postgres, real HTTP). Calls
 * `processor.process()`/`onFailed()` directly (mirroring
 * `email.processor.spec.ts`'s `new EmailProcessor()` + direct `.process()`
 * call precedent) rather than going through a real BullMQ queue — this
 * process boundary (apps/worker never boots apps/api, and no e2e suite
 * boots apps/worker either) was already established as this codebase's
 * discipline for cross-process features; the M40 manual verification
 * (curl + a real running worker + a real local HTTP receiver) already
 * proved the full real queue → retry → delivery path end-to-end. This spec
 * is the permanent, repeatable regression test for the processor's own
 * logic: HMAC signing, delivered/pending/failed status transitions, and
 * graceful no-throw behavior for missing rows/unknown jobs.
 */
describe("WebhookDeliveryProcessor", () => {
  const prisma = createBasePrismaClient(process.env.DATABASE_URL_APP);
  let processor: WebhookDeliveryProcessor;
  let tenantId: string;

  beforeAll(async () => {
    processor = new WebhookDeliveryProcessor();
    const suffix = randomBytes(4).toString("hex");
    const tenant = await prisma.tenant.create({
      data: { name: "WH Processor Test", subdomain: `wh-proc-test-${suffix}` },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    // `tenants` cascades onto webhook_subscriptions/webhook_deliveries
    // (onDelete: Cascade) — deleting the tenant is enough cleanup.
    await prisma.tenant
      .delete({ where: { id: tenantId } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  async function createSubscription(url: string, secret: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      return tx.webhookSubscription.create({
        data: { tenantId, url, secret, eventTypes: ["order.created"] },
      });
    });
  }

  async function createDelivery(subscriptionId: string, payload: object) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      return tx.webhookDelivery.create({
        data: {
          tenantId,
          subscriptionId,
          eventType: "order.created",
          payload: payload as any,
        },
      });
    });
  }

  async function getDelivery(id: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
      return tx.webhookDelivery.findUniqueOrThrow({ where: { id } });
    });
  }

  function startReceiver(
    handler: (
      req: http.IncomingMessage,
      body: string,
      res: http.ServerResponse,
    ) => void,
  ): Promise<{ server: http.Server; port: number }> {
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => handler(req, body, res));
    });
    return new Promise((resolve) => {
      server.listen(0, () =>
        resolve({ server, port: (server.address() as any).port }),
      );
    });
  }

  it("delivers a webhook with a genuine HMAC-SHA256 signature and marks the delivery delivered", async () => {
    const secret = "test-secret-delivered";
    let received: { headers: http.IncomingHttpHeaders; body: string } | null =
      null;
    const { server, port } = await startReceiver((req, body, res) => {
      received = { headers: req.headers, body };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });

    try {
      const subscription = await createSubscription(
        `http://127.0.0.1:${port}/hook`,
        secret,
      );
      const delivery = await createDelivery(subscription.id, {
        orderId: "order-1",
        grandTotal: 10,
      });

      await processor.process({
        name: WEBHOOK_DELIVERY_JOB_NAMES.deliver,
        data: { tenantId, deliveryId: delivery.id },
      } as any);

      expect(received).not.toBeNull();
      const expectedSignature =
        "sha256=" +
        createHmac("sha256", secret).update(received!.body).digest("hex");
      expect(received!.headers["x-webhook-signature"]).toBe(expectedSignature);
      expect(received!.headers["x-webhook-event"]).toBe("order.created");
      expect(received!.headers["x-webhook-delivery-id"]).toBe(delivery.id);
      expect(JSON.parse(received!.body)).toEqual({
        orderId: "order-1",
        grandTotal: 10,
      });

      const updated = await getDelivery(delivery.id);
      expect(updated.status).toBe("delivered");
      expect(updated.responseStatus).toBe(200);
      expect(updated.attempt).toBe(1);
      expect(updated.deliveredAt).not.toBeNull();
    } finally {
      server.close();
    }
  });

  it("throws on a non-2xx response, records the attempt, and leaves status pending (BullMQ's own retry decides what happens next)", async () => {
    const { server, port } = await startReceiver((_req, _body, res) => {
      res.writeHead(500);
      res.end();
    });

    try {
      const subscription = await createSubscription(
        `http://127.0.0.1:${port}/hook`,
        "test-secret-failing",
      );
      const delivery = await createDelivery(subscription.id, {
        orderId: "order-2",
      });

      await expect(
        processor.process({
          name: WEBHOOK_DELIVERY_JOB_NAMES.deliver,
          data: { tenantId, deliveryId: delivery.id },
        } as any),
      ).rejects.toThrow();

      const updated = await getDelivery(delivery.id);
      expect(updated.status).toBe("pending"); // not terminal — only the exhausted-retries `failed` event sets this
      expect(updated.attempt).toBe(1);
    } finally {
      server.close();
    }
  });

  it("onFailed marks the delivery failed once BullMQ's own attempts are exhausted", async () => {
    const subscription = await createSubscription(
      "http://127.0.0.1:1/unreachable",
      "test-secret-exhausted",
    );
    const delivery = await createDelivery(subscription.id, {
      orderId: "order-3",
    });

    const exhaustedJob = {
      data: { tenantId, deliveryId: delivery.id },
      attemptsMade: 5,
      opts: { attempts: 5 },
    };
    await processor.onFailed(
      exhaustedJob as any,
      new Error("simulated permanent failure"),
    );

    const updated = await getDelivery(delivery.id);
    expect(updated.status).toBe("failed");
  });

  it("onFailed does NOT mark the delivery failed while BullMQ still has retries left", async () => {
    const subscription = await createSubscription(
      "http://127.0.0.1:1/unreachable",
      "test-secret-midretry",
    );
    const delivery = await createDelivery(subscription.id, {
      orderId: "order-4",
    });

    const midRetryJob = {
      data: { tenantId, deliveryId: delivery.id },
      attemptsMade: 2,
      opts: { attempts: 5 },
    };
    await processor.onFailed(
      midRetryJob as any,
      new Error("attempt 2 of 5 failed"),
    );

    const updated = await getDelivery(delivery.id);
    expect(updated.status).toBe("pending");
  });

  it("does nothing (no throw) for an unrecognized job name", async () => {
    await expect(
      processor.process({ name: "some-unknown-job", data: {} } as any),
    ).resolves.toBeUndefined();
  });

  it("skips gracefully (no throw) when the delivery no longer exists", async () => {
    await expect(
      processor.process({
        name: WEBHOOK_DELIVERY_JOB_NAMES.deliver,
        data: { tenantId, deliveryId: "00000000-0000-0000-0000-000000000000" },
      } as any),
    ).resolves.toBeUndefined();
  });
});
