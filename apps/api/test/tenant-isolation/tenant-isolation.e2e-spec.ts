import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import Stripe from 'stripe';
import { createBasePrismaClient } from '@saas/database';
import { AppModule } from '../../src/app.module';

/**
 * Required CI gate — arch.md §4 / 08-development-roadmap.md's Phase 1 exit
 * criteria: "confirm that tenant B's data is fully inaccessible via tenant
 * A's session (automated test passing)."
 *
 * Boots the REAL Nest app and drives it entirely through HTTP (real
 * register/login/JWT), exercising the full guard/interceptor/RLS chain —
 * not a mocked shortcut. Self-seeds its two tenants via the actual
 * `/auth/register` flow rather than a separate seed script, so this suite
 * has no external setup dependency beyond a migrated, empty database.
 */
describe('Tenant isolation (e2e)', () => {
  let app: INestApplication;
  let server: import('http').Server;

  let tenantAId: string;
  let tenantBId: string;
  let ownerAToken: string;
  let ownerBToken: string;
  let ownerAUserId: string;
  let ownerBUserId: string;
  let staffAUserId: string;

  const suffix = randomBytes(4).toString('hex');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    server = app.getHttpServer();

    const regA = await request(server)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Isolation Test A',
        subdomain: `iso-a-${suffix}`,
        email: `owner-a-${suffix}@example.com`,
        password: 'IsolationTest123!',
      })
      .expect(201);
    tenantAId = regA.body.tenantId;
    ownerAToken = regA.body.tokens.accessToken;

    const regB = await request(server)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Isolation Test B',
        subdomain: `iso-b-${suffix}`,
        email: `owner-b-${suffix}@example.com`,
        password: 'IsolationTest123!',
      })
      .expect(201);
    tenantBId = regB.body.tenantId;
    ownerBToken = regB.body.tokens.accessToken;

    const meA = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    ownerAUserId = meA.body.user.id;

    const meB = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    ownerBUserId = meB.body.user.id;

    // Give tenant A a second user so its list endpoint has something a
    // trivial "one owner each" fixture couldn't catch a leak against.
    const rolesA = await request(server)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    const staffRoleA = rolesA.body.find(
      (r: { name: string }) => r.name === 'staff',
    );

    const invite = await request(server)
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ email: `staff-a-${suffix}@example.com`, roleId: staffRoleA.id })
      .expect(201);
    staffAUserId = invite.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sanity: the two registrations produced genuinely distinct tenants', () => {
    expect(tenantAId).not.toBe(tenantBId);
  });

  it("list endpoints never return another tenant's rows", async () => {
    const resA = await request(server)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    const idsA = resA.body.map((u: { id: string }) => u.id);
    expect(idsA).toEqual(expect.arrayContaining([ownerAUserId, staffAUserId]));
    expect(idsA).not.toContain(ownerBUserId);

    const resB = await request(server)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    const idsB = resB.body.map((u: { id: string }) => u.id);
    expect(idsB).toEqual([ownerBUserId]);
    expect(idsB).not.toContain(ownerAUserId);
    expect(idsB).not.toContain(staffAUserId);
  });

  it('a cross-tenant single-record lookup 404s (RESOURCE_NOT_FOUND) rather than returning or leaking the row', async () => {
    const res = await request(server)
      .patch(`/api/v1/users/${ownerAUserId}`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .send({ isActive: false })
      .expect(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it("a tenant's JWT is rejected against a different tenant's resolved subdomain", async () => {
    const tenantB = await request(server)
      .get('/api/v1/tenants/me')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);

    const res = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('X-Tenant-Subdomain', tenantB.body.subdomain)
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('RLS itself — not just app-layer filtering — blocks cross-tenant reads (bypasses Nest entirely)', async () => {
    // Connects as app_user directly, no Nest/guards/interceptors involved at
    // all — this is the test that actually proves the database enforces
    // isolation, not just that our application code happens to filter
    // correctly (arch.md §4's stated design: RLS is the real boundary,
    // app-layer scoping is defense-in-depth only).
    const prisma = createBasePrismaClient(process.env.DATABASE_URL_APP);
    try {
      const rows = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantAId}'`);
        return tx.user.findMany({ where: { id: ownerBUserId } });
      });
      expect(rows).toHaveLength(0);

      const rowsNoContext = await prisma.user.findMany({
        where: { id: ownerAUserId },
      });
      expect(rowsNoContext).toHaveLength(0);
    } finally {
      await prisma.$disconnect();
    }
  });
});

/**
 * Phase 2 extension — same suite shape as above, applied to the commerce
 * tables added this phase (Product/ProductVariant/Inventory/Customer).
 * Reuses tenant A/B fixtures from a fresh registration of its own rather
 * than sharing state with the block above, so this describe can run in
 * isolation (e.g. `--testNamePattern`) without depending on execution order.
 */
describe('Tenant isolation (e2e) — Phase 2 commerce', () => {
  let app: INestApplication;
  let server: import('http').Server;

  let tenantAId: string;
  let tenantBId: string;
  let subdomainA: string;
  let subdomainB: string;
  let ownerAToken: string;
  let ownerBToken: string;

  let productAId: string;
  let variantAId: string;
  let customerAId: string;

  const suffix = randomBytes(4).toString('hex');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    server = app.getHttpServer();

    subdomainA = `iso-p2-a-${suffix}`;
    subdomainB = `iso-p2-b-${suffix}`;

    const regA = await request(server)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Isolation P2 A',
        subdomain: subdomainA,
        email: `owner-p2-a-${suffix}@example.com`,
        password: 'IsolationTest123!',
      })
      .expect(201);
    tenantAId = regA.body.tenantId;
    ownerAToken = regA.body.tokens.accessToken;

    const regB = await request(server)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Isolation P2 B',
        subdomain: subdomainB,
        email: `owner-p2-b-${suffix}@example.com`,
        password: 'IsolationTest123!',
      })
      .expect(201);
    tenantBId = regB.body.tenantId;
    ownerBToken = regB.body.tokens.accessToken;

    // Tenant A gets one published product with a variant (and thus an
    // Inventory row via the default-warehouse auto-create path) — tenant B
    // gets nothing, so any leak shows up as tenant B seeing a non-empty list.
    const productA = await request(server)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        name: 'Isolation Test Product',
        slug: `iso-product-${suffix}`,
        basePrice: 10,
        status: 'published',
        variant: { sku: `ISO-SKU-${suffix}`, initialStock: 5 },
      })
      .expect(201);
    productAId = productA.body.id;
    variantAId = productA.body.variants[0].id;

    const customerA = await request(server)
      .post('/api/v1/customers/register')
      .set('X-Tenant-Subdomain', subdomainA)
      .send({
        email: `cust-p2-a-${suffix}@example.com`,
        password: 'CustomerTest123!',
      })
      .expect(201);
    // register() only returns { tokens } (no customer row) — fetch the id
    // via the freshly issued customer token's own /me route.
    const meCustomerA = await request(server)
      .get('/api/v1/customers/me')
      .set('Authorization', `Bearer ${customerA.body.tokens.accessToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .expect(200);
    customerAId = meCustomerA.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sanity: the two registrations produced genuinely distinct tenants', () => {
    expect(tenantAId).not.toBe(tenantBId);
  });

  it("tenant B's product list is empty while tenant A's contains the fixture product", async () => {
    const resA = await request(server)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    expect(resA.body.map((p: { id: string }) => p.id)).toContain(productAId);

    const resB = await request(server)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    expect(resB.body).toEqual([]);
  });

  it('a cross-tenant product lookup 404s rather than returning or leaking the row', async () => {
    const res = await request(server)
      .get(`/api/v1/products/${productAId}`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it("a cross-tenant inventory adjustment on tenant A's variant 404s under tenant B's token", async () => {
    const res = await request(server)
      .patch(`/api/v1/inventory/${variantAId}`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .send({ delta: -1, reasonCode: 'manual_correction' })
      .expect(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');

    // Confirm the legitimate owner's adjustment on the same variant still
    // works — proves the 404 above was tenant scoping, not a broken route.
    await request(server)
      .patch(`/api/v1/inventory/${variantAId}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ delta: -1, reasonCode: 'manual_correction' })
      .expect(200);
  });

  it("tenant B's customer list never contains tenant A's customer", async () => {
    const resB = await request(server)
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    expect(resB.body.map((c: { id: string }) => c.id)).not.toContain(
      customerAId,
    );

    const resA = await request(server)
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    expect(resA.body.map((c: { id: string }) => c.id)).toContain(customerAId);
    // passwordHash must never leave the API process (see strip-password-hash.ts).
    expect(resA.body[0]).not.toHaveProperty('passwordHash');
  });

  it("a customer session token issued under tenant A's subdomain is rejected against tenant B's resolved store", async () => {
    const loginA = await request(server)
      .post('/api/v1/customers/login')
      .set('X-Tenant-Subdomain', subdomainA)
      .send({
        email: `cust-p2-a-${suffix}@example.com`,
        password: 'CustomerTest123!',
      })
      .expect(201);
    const customerAToken = loginA.body.tokens.accessToken;

    const res = await request(server)
      .get('/api/v1/customers/me')
      .set('Authorization', `Bearer ${customerAToken}`)
      .set('X-Tenant-Subdomain', subdomainB)
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');

    // Same token against its own tenant still works.
    await request(server)
      .get('/api/v1/customers/me')
      .set('Authorization', `Bearer ${customerAToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .expect(200);
  });

  it('a staff JWT is rejected on customer-only routes and vice versa', async () => {
    const loginA = await request(server)
      .post('/api/v1/customers/login')
      .set('X-Tenant-Subdomain', subdomainA)
      .send({
        email: `cust-p2-a-${suffix}@example.com`,
        password: 'CustomerTest123!',
      })
      .expect(201);
    const customerAToken = loginA.body.tokens.accessToken;

    // Staff token on a customer-only route.
    await request(server)
      .get('/api/v1/customers/me')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .expect(401);

    // Customer token on a staff-only route.
    await request(server)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(401);
  });

  it('RLS blocks cross-tenant reads on the new commerce tables directly (bypasses Nest entirely)', async () => {
    const prisma = createBasePrismaClient(process.env.DATABASE_URL_APP);
    try {
      const rows = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantBId}'`);
        return tx.product.findMany({ where: { id: productAId } });
      });
      expect(rows).toHaveLength(0);

      const rowsNoContext = await prisma.product.findMany({
        where: { id: productAId },
      });
      expect(rowsNoContext).toHaveLength(0);
    } finally {
      await prisma.$disconnect();
    }
  });
});

/**
 * Phase 3 extension — same suite shape as above, applied to the Sales
 * tables (Cart/Coupon/Order/PaymentAccount). Drives a full real checkout
 * (product → cart → Stripe Connect onboarding (stub mode) → checkout/
 * complete) so Order/PaymentTransaction rows genuinely exist to test
 * isolation against, not just directly-inserted fixtures.
 */
describe('Tenant isolation (e2e) — Phase 3 sales', () => {
  let app: INestApplication;
  let server: import('http').Server;

  let tenantAId: string;
  let tenantBId: string;
  let subdomainA: string;
  let subdomainB: string;
  let ownerAToken: string;
  let ownerBToken: string;

  let couponAId: string;
  let orderAId: string;
  let customerATokenValue: string;

  const suffix = randomBytes(4).toString('hex');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    server = app.getHttpServer();

    subdomainA = `iso-p3-a-${suffix}`;
    subdomainB = `iso-p3-b-${suffix}`;

    const regA = await request(server)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Isolation P3 A',
        subdomain: subdomainA,
        email: `owner-p3-a-${suffix}@example.com`,
        password: 'IsolationTest123!',
      })
      .expect(201);
    tenantAId = regA.body.tenantId;
    ownerAToken = regA.body.tokens.accessToken;

    const regB = await request(server)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Isolation P3 B',
        subdomain: subdomainB,
        email: `owner-p3-b-${suffix}@example.com`,
        password: 'IsolationTest123!',
      })
      .expect(201);
    tenantBId = regB.body.tenantId;
    ownerBToken = regB.body.tokens.accessToken;

    // Tenant A: product, coupon, shipping zone/rate, Connect onboarding.
    const productA = await request(server)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        name: 'Isolation P3 Product',
        slug: `iso-p3-product-${suffix}`,
        basePrice: 20,
        status: 'published',
        variant: { sku: `ISO-P3-SKU-${suffix}`, initialStock: 10 },
      })
      .expect(201);
    const variantAId = productA.body.variants[0].id;

    const couponA = await request(server)
      .post('/api/v1/coupons')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ code: `ISOCOUPON${suffix}`, type: 'fixed', value: 5 })
      .expect(201);
    couponAId = couponA.body.id;

    const zoneA = await request(server)
      .post('/api/v1/shipping-zones')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ name: 'Zone A', regions: ['US'] })
      .expect(201);
    await request(server)
      .post(`/api/v1/shipping-zones/${zoneA.body.id}/rates`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ name: 'Flat', type: 'flat_rate', amount: 5 })
      .expect(201);

    await request(server)
      .post('/api/v1/payments/connect/onboard')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(201);

    // Customer A: register, add to cart, complete checkout.
    const customerA = await request(server)
      .post('/api/v1/customers/register')
      .set('X-Tenant-Subdomain', subdomainA)
      .send({
        email: `cust-p3-a-${suffix}@example.com`,
        password: 'CustomerTest123!',
      })
      .expect(201);
    customerATokenValue = customerA.body.tokens.accessToken;

    await request(server)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerATokenValue}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .send({ variantId: variantAId, quantity: 1 })
      .expect(201);

    const checkout = await request(server)
      .post('/api/v1/checkout/complete')
      .set('Authorization', `Bearer ${customerATokenValue}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .send({
        shippingAddress: {
          line1: '1 Test St',
          city: 'Testville',
          country: 'US',
        },
      })
      .expect(201);
    orderAId = checkout.body.order.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sanity: the two registrations produced genuinely distinct tenants', () => {
    expect(tenantAId).not.toBe(tenantBId);
  });

  it("tenant B's coupon list is empty while tenant A's contains the fixture coupon", async () => {
    const resA = await request(server)
      .get('/api/v1/coupons')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    expect(resA.body.map((c: { id: string }) => c.id)).toContain(couponAId);

    const resB = await request(server)
      .get('/api/v1/coupons')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    expect(resB.body).toEqual([]);
  });

  it("tenant B's order list is empty while tenant A's contains the checkout-created order; cross-tenant lookup 404s", async () => {
    const resA = await request(server)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    expect(resA.body.map((o: { id: string }) => o.id)).toContain(orderAId);

    const resB = await request(server)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    expect(resB.body).toEqual([]);

    const lookup = await request(server)
      .get(`/api/v1/orders/${orderAId}`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(404);
    expect(lookup.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it("tenant B's own PaymentAccount is independent of (and was never set by) tenant A's onboarding", async () => {
    const resB = await request(server)
      .get('/api/v1/payments/connect/status')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    expect(resB.body.onboardingStatus).toBe('not_started');
    expect(resB.body.stripeAccountId).toBeNull();
  });

  it("customer A's cart/order is inaccessible via a resolved tenant B store", async () => {
    const res = await request(server)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${customerATokenValue}`)
      .set('X-Tenant-Subdomain', subdomainB)
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('RLS blocks cross-tenant reads on Order directly (bypasses Nest entirely)', async () => {
    const prisma = createBasePrismaClient(process.env.DATABASE_URL_APP);
    try {
      const rows = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantBId}'`);
        return tx.order.findMany({ where: { id: orderAId } });
      });
      expect(rows).toHaveLength(0);

      const rowsNoContext = await prisma.order.findMany({
        where: { id: orderAId },
      });
      expect(rowsNoContext).toHaveLength(0);
    } finally {
      await prisma.$disconnect();
    }
  });
});

/**
 * Formal regression test for the webhook idempotency guarantee proven
 * manually during M18 (FR-PM-04 / NFR-AV-03): the same signed Stripe event
 * delivered twice must be processed exactly once. Deliberately its own
 * top-level describe (no tenant fixtures needed) — signature verification
 * and the `@@unique([source, eventId])` insert-or-skip are tenant-agnostic.
 */
describe('Webhook idempotency (e2e)', () => {
  let app: INestApplication;
  let server: import('http').Server;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    // rawBody: true — same requirement as main.ts's real bootstrap;
    // WebhooksController needs `req.rawBody` (the exact signed bytes), and
    // createNestApplication() doesn't inherit that option from anywhere
    // else, it must be passed here explicitly too.
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('the same signed webhook event delivered twice is processed exactly once', async () => {
    const stripe = new Stripe('sk_test_stub_mode_placeholder');
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    const eventId = `evt_idem_test_${randomBytes(6).toString('hex')}`;
    const payload = JSON.stringify({
      id: eventId,
      object: 'event',
      type: 'some.unhandled.event',
      data: { object: {} },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });

    const first = await request(server)
      .post('/api/v1/webhooks/stripe/connect')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', signature)
      .send(payload)
      .expect(201);
    expect(first.body).toEqual({ received: true, duplicate: false });

    const second = await request(server)
      .post('/api/v1/webhooks/stripe/connect')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', signature)
      .send(payload)
      .expect(201);
    expect(second.body).toEqual({ received: true, duplicate: true });

    const prisma = createBasePrismaClient(process.env.DATABASE_URL_APP);
    try {
      const rows = await prisma.webhookEvent.findMany({
        where: { source: 'stripe', eventId },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].processed).toBe(true);
    } finally {
      await prisma.$disconnect();
    }
  });
});

/**
 * Phase 4 extension — same suite shape as Phase 2/3, applied to Reviews and
 * Analytics. Drives a full real purchase (product → shipping/Connect setup
 * → cart → checkout) exactly like the Phase 3 fixture, then pushes the
 * order to `delivered` (staff PATCH — no state-machine validation to fight)
 * so a real review can be submitted against a genuinely qualifying order,
 * not a directly-inserted fixture row.
 */
describe('Tenant isolation (e2e) — Phase 4 reviews & analytics', () => {
  let app: INestApplication;
  let server: import('http').Server;

  let tenantAId: string;
  let tenantBId: string;
  let subdomainA: string;
  let subdomainB: string;
  let ownerAToken: string;
  let ownerBToken: string;

  let reviewAId: string;
  let staffAToken: string;

  const suffix = randomBytes(4).toString('hex');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    server = app.getHttpServer();

    subdomainA = `iso-p4-a-${suffix}`;
    subdomainB = `iso-p4-b-${suffix}`;

    const regA = await request(server)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Isolation P4 A',
        subdomain: subdomainA,
        email: `owner-p4-a-${suffix}@example.com`,
        password: 'IsolationTest123!',
      })
      .expect(201);
    tenantAId = regA.body.tenantId;
    ownerAToken = regA.body.tokens.accessToken;

    const regB = await request(server)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Isolation P4 B',
        subdomain: subdomainB,
        email: `owner-p4-b-${suffix}@example.com`,
        password: 'IsolationTest123!',
      })
      .expect(201);
    tenantBId = regB.body.tenantId;
    ownerBToken = regB.body.tokens.accessToken;

    // Tenant A: product, shipping zone/rate, Connect onboarding — same
    // minimum viable setup as the Phase 3 fixture — then a real checkout.
    const productA = await request(server)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        name: 'Isolation P4 Product',
        slug: `iso-p4-product-${suffix}`,
        basePrice: 15,
        status: 'published',
        variant: { sku: `ISO-P4-SKU-${suffix}`, initialStock: 10 },
      })
      .expect(201);
    const productAId = productA.body.id;
    const variantAId = productA.body.variants[0].id;

    const zoneA = await request(server)
      .post('/api/v1/shipping-zones')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ name: 'Zone A', regions: ['US'] })
      .expect(201);
    await request(server)
      .post(`/api/v1/shipping-zones/${zoneA.body.id}/rates`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ name: 'Flat', type: 'flat_rate', amount: 5 })
      .expect(201);

    await request(server)
      .post('/api/v1/payments/connect/onboard')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(201);

    const customerA = await request(server)
      .post('/api/v1/customers/register')
      .set('X-Tenant-Subdomain', subdomainA)
      .send({
        email: `cust-p4-a-${suffix}@example.com`,
        password: 'CustomerTest123!',
      })
      .expect(201);
    const customerAToken = customerA.body.tokens.accessToken;

    await request(server)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .send({ variantId: variantAId, quantity: 1 })
      .expect(201);

    const checkout = await request(server)
      .post('/api/v1/checkout/complete')
      .set('Authorization', `Bearer ${customerAToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .send({
        shippingAddress: {
          line1: '1 Test St',
          city: 'Testville',
          country: 'US',
        },
      })
      .expect(201);
    const orderAId = checkout.body.order.id;

    // Push straight to `delivered` — OrdersService#updateStatus has no
    // state-machine validation (see that service's own code), so this is a
    // legitimate direct transition for test setup purposes, not a bypass of
    // anything the real app enforces.
    await request(server)
      .patch(`/api/v1/orders/${orderAId}/status`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ status: 'delivered' })
      .expect(200);

    const review = await request(server)
      .post(`/api/v1/products/${productAId}/reviews`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .send({ rating: 5, comment: 'Isolation test review' })
      .expect(201);
    reviewAId = review.body.id;

    await request(server)
      .patch(`/api/v1/reviews/${reviewAId}/moderate`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ status: 'approved' })
      .expect(200);

    // A staff-role (not owner) user for the analytics.export permission
    // boundary check below — invited via the real endpoint, then activated
    // directly via the DB (mirroring UsersService#acceptInvite's own
    // effect) so this suite has no Mailhog/worker dependency, consistent
    // with this file's stated self-contained-suite discipline.
    const rolesA = await request(server)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    const staffRoleA = rolesA.body.find(
      (r: { name: string }) => r.name === 'staff',
    );
    const staffEmail = `staff-p4-${suffix}@example.com`;
    await request(server)
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ email: staffEmail, roleId: staffRoleA.id })
      .expect(201);

    const passwordHash = await argon2.hash('StaffP4Test123!');
    const activatePrisma = createBasePrismaClient(process.env.DATABASE_URL_APP);
    try {
      await activatePrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantAId}'`);
        await tx.user.updateMany({
          where: { tenantId: tenantAId, email: staffEmail },
          data: { passwordHash, isActive: true, emailVerifiedAt: new Date() },
        });
      });
    } finally {
      await activatePrisma.$disconnect();
    }

    const staffLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({
        email: staffEmail,
        password: 'StaffP4Test123!',
        subdomain: subdomainA,
      })
      .expect(201);
    staffAToken = staffLogin.body.tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sanity: the two registrations produced genuinely distinct tenants', () => {
    expect(tenantAId).not.toBe(tenantBId);
  });

  it("tenant B's review queue is empty while tenant A's contains the fixture review; cross-tenant moderate 404s", async () => {
    const resA = await request(server)
      .get('/api/v1/reviews')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    expect(resA.body.map((r: { id: string }) => r.id)).toContain(reviewAId);

    const resB = await request(server)
      .get('/api/v1/reviews')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    expect(resB.body).toEqual([]);

    const lookup = await request(server)
      .patch(`/api/v1/reviews/${reviewAId}/moderate`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .send({ status: 'hidden' })
      .expect(404);
    expect(lookup.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('RLS blocks cross-tenant reads on reviews directly (bypasses Nest entirely)', async () => {
    const prisma = createBasePrismaClient(process.env.DATABASE_URL_APP);
    try {
      const rows = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantBId}'`);
        return tx.review.findMany({ where: { id: reviewAId } });
      });
      expect(rows).toHaveLength(0);

      const rowsNoContext = await prisma.review.findMany({
        where: { id: reviewAId },
      });
      expect(rowsNoContext).toHaveLength(0);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("tenant B's analytics never reflect tenant A's order revenue", async () => {
    const resB = await request(server)
      .get('/api/v1/analytics/revenue')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    expect(resB.body.totalRevenue).toBe(0);
    expect(resB.body.buckets).toEqual([]);
  });

  /**
   * Formalizes the M25 manual checkpoint: staff has `analytics.view` but
   * NOT `analytics.export` (packages/database/src/permissions.ts) — the API
   * spec's "Staff+" annotation on /analytics/export only describes the
   * route's minimum auth tier, not the real gate, so this must 403
   * specifically while every other /analytics/* route 200s for the same
   * staff token.
   */
  it('a staff token 200s on analytics.view routes but 403s on analytics.export specifically', async () => {
    await request(server)
      .get('/api/v1/analytics/revenue')
      .set('Authorization', `Bearer ${staffAToken}`)
      .expect(200);
    await request(server)
      .get('/api/v1/analytics/inventory')
      .set('Authorization', `Bearer ${staffAToken}`)
      .expect(200);

    const res = await request(server)
      .get('/api/v1/analytics/export?type=revenue&format=csv')
      .set('Authorization', `Bearer ${staffAToken}`)
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

/**
 * Phase 5 extension — SaaS features (plan limits, billing webhooks, dunning,
 * Super Admin plan overrides). Same suite shape as Phases 2-4, with one
 * departure: it logs in as the platform Super Admin (`superadmin@platform.test`
 * / `Password123!`, created by packages/database/prisma/seed.ts) to exercise
 * the plan-override/status-change routes — every other describe block in
 * this file is fully self-seeding, but there is no HTTP path to create a
 * Super Admin account (by design — see ensureSuperAdminRole's own comment),
 * so this one block has a real, disclosed dependency on the seed having run
 * against this database at least once. `ensureDefaultSubscriptionForTenant`
 * (bootstrap.ts) has this same seed dependency already, via the `isDefault`
 * Plan a fresh registration picks up — not a new fragility this test
 * introduces.
 */
describe('Tenant isolation (e2e) — Phase 5 SaaS features', () => {
  let app: INestApplication;
  let server: import('http').Server;

  let tenantAId: string;
  let tenantBId: string;
  let subdomainA: string;
  let subdomainB: string;
  let ownerAToken: string;
  let ownerBToken: string;
  let superAdminToken: string;

  const suffix = randomBytes(4).toString('hex');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    // rawBody: true — this block's dunning-cycle test signs and posts to
    // /webhooks/stripe/billing, same requirement as the Webhook idempotency
    // block above.
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    await app.init();
    server = app.getHttpServer();

    subdomainA = `iso-p5-a-${suffix}`;
    subdomainB = `iso-p5-b-${suffix}`;

    const regA = await request(server)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Isolation P5 A',
        subdomain: subdomainA,
        email: `owner-p5-a-${suffix}@example.com`,
        password: 'IsolationTest123!',
      })
      .expect(201);
    tenantAId = regA.body.tenantId;
    ownerAToken = regA.body.tokens.accessToken;

    const regB = await request(server)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Isolation P5 B',
        subdomain: subdomainB,
        email: `owner-p5-b-${suffix}@example.com`,
        password: 'IsolationTest123!',
      })
      .expect(201);
    tenantBId = regB.body.tenantId;
    ownerBToken = regB.body.tokens.accessToken;

    const superLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'superadmin@platform.test', password: 'Password123!' })
      .expect(201);
    superAdminToken = superLogin.body.tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sanity: the two registrations produced genuinely distinct tenants', () => {
    expect(tenantAId).not.toBe(tenantBId);
  });

  it('a fresh tenant gets its own default Subscription (the seeded isDefault Plan) with independently computed usage', async () => {
    const planA = await request(server)
      .get('/api/v1/billing/plan')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    const planB = await request(server)
      .get('/api/v1/billing/plan')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);

    expect(planA.body.plan.isDefault).toBe(true);
    expect(planA.body.subscription.tenantId).toBe(tenantAId);
    expect(planB.body.subscription.tenantId).toBe(tenantBId);
    expect(planA.body.subscription.id).not.toBe(planB.body.subscription.id);

    // A fresh tenant has exactly one User row (its owner) — proves usage is
    // computed per-tenant, not a shared/global count.
    const staffUsageA = planA.body.usage.find(
      (u: { metric: string }) => u.metric === 'staff_seats',
    );
    expect(staffUsageA.count).toBe(1);
  });

  it("a Super-Admin-granted plan override for tenant A blocks A's next staff invite without affecting tenant B's own limit resolution", async () => {
    const future = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await request(server)
      .post(`/api/v1/tenants/${tenantAId}/plan-override`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        metric: 'staff_seats',
        overrideValue: 1,
        reason: 'e2e isolation test',
        expiresAt: future,
      })
      .expect(201);

    const rolesA = await request(server)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    const staffRoleA = rolesA.body.find(
      (r: { name: string }) => r.name === 'staff',
    );

    // Tenant A already has 1 User (its owner) === the override's limit of 1
    // — the very next invite is blocked.
    const blockedA = await request(server)
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        email: `staff-p5-a-${suffix}@example.com`,
        roleId: staffRoleA.id,
      })
      .expect(403);
    expect(blockedA.body.error.code).toBe('PLAN_LIMIT_EXCEEDED');

    // Tenant B has no override of its own — its Free Trial limit (5 seats,
    // currently at 1) is untouched by A's override, proving resolution is
    // tenant-scoped, not accidentally global/cached.
    const rolesB = await request(server)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    const staffRoleB = rolesB.body.find(
      (r: { name: string }) => r.name === 'staff',
    );
    await request(server)
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .send({
        email: `staff-p5-b-${suffix}@example.com`,
        roleId: staffRoleB.id,
      })
      .expect(201);
  });

  it('RLS blocks cross-tenant reads on the 4 new Phase 5 tenant-scoped tables directly (bypasses Nest entirely)', async () => {
    const prisma = createBasePrismaClient(process.env.DATABASE_URL_APP);
    try {
      // Subscription (bootstrap) and TenantPlanOverride (granted above)
      // already have real tenant-A rows by this point. UsageCounter gets a
      // directly-seeded fixture row here instead of via a real checkout:
      // CheckoutService only ever writes to usage_counters when the
      // effective order_volume limit resolves non-null (the seeded Free
      // Trial plan has no order_volume row = unlimited — see that service's
      // own comment), so driving a full product/shipping/Connect/checkout
      // fixture just to populate this one row would only re-exercise
      // already-covered (M31-verified) increment logic, not the RLS policy
      // this test targets — a disclosed, deliberate simplification.
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantAId}'`);
        await tx.usageCounter.create({
          data: {
            tenantId: tenantAId,
            metric: 'order_volume',
            period: '2026-01',
            count: 3,
          },
        });
      });

      const subRows = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantBId}'`);
        return tx.subscription.findMany({ where: { tenantId: tenantAId } });
      });
      expect(subRows).toHaveLength(0);

      const overrideRows = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantBId}'`);
        return tx.tenantPlanOverride.findMany({
          where: { tenantId: tenantAId },
        });
      });
      expect(overrideRows).toHaveLength(0);

      const usageRows = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantBId}'`);
        return tx.usageCounter.findMany({ where: { tenantId: tenantAId } });
      });
      expect(usageRows).toHaveLength(0);

      const noContextSub = await prisma.subscription.findMany({
        where: { tenantId: tenantAId },
      });
      expect(noContextSub).toHaveLength(0);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('a signed invoice.payment_failed webhook moves a tenant to past_due and records an Invoice row; a subsequent invoice.paid recovers it back to active', async () => {
    // Give both subscriptions a stripeSubscriptionId — bootstrap's
    // ensureDefaultSubscriptionForTenant deliberately leaves this null (no
    // real Stripe customer/subscription exists yet for a free-plan tenant,
    // see that function's own comment), but BillingWebhookService resolves
    // `tenantId` by looking up the local Subscription via exactly this
    // field, so a synthetic-event test has to seed it first — same
    // "SET LOCAL then direct write" fixture technique already used
    // throughout this file for RLS-protected tables.
    const stripeSubA = `sub_test_p5_a_${suffix}`;
    const stripeSubB = `sub_test_p5_b_${suffix}`;
    const fixturePrisma = createBasePrismaClient(process.env.DATABASE_URL_APP);
    try {
      await fixturePrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantAId}'`);
        await tx.subscription.update({
          where: { tenantId: tenantAId },
          data: { stripeSubscriptionId: stripeSubA },
        });
      });
      await fixturePrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantBId}'`);
        await tx.subscription.update({
          where: { tenantId: tenantBId },
          data: { stripeSubscriptionId: stripeSubB },
        });
      });
    } finally {
      await fixturePrisma.$disconnect();
    }

    // BillingWebhookService only transitions active→past_due (see its own
    // comment) — a brand new registration starts in `trial`, not `active`
    // (confirmed via the Super Admin tenant list during manual M35
    // verification), so this test's tenants need a real status-change
    // through the Super Admin route first, exactly like a trial converting
    // to a paying subscription would in production.
    await request(server)
      .patch(`/api/v1/tenants/${tenantAId}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        status: 'active',
        reason: 'e2e fixture: trial converted to active',
      })
      .expect(200);
    await request(server)
      .patch(`/api/v1/tenants/${tenantBId}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        status: 'active',
        reason: 'e2e fixture: trial converted to active',
      })
      .expect(200);

    const stripe = new Stripe('sk_test_stub_mode_placeholder');
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;

    const signAndSend = (event: Record<string, unknown>) => {
      const payload = JSON.stringify(event);
      const signature = stripe.webhooks.generateTestHeaderString({
        payload,
        secret,
      });
      return request(server)
        .post('/api/v1/webhooks/stripe/billing')
        .set('Content-Type', 'application/json')
        .set('Stripe-Signature', signature)
        .send(payload)
        .expect(201);
    };

    const invoiceEvent = (
      eventId: string,
      type: 'invoice.payment_failed' | 'invoice.paid',
      invoiceId: string,
      stripeSubscriptionId: string,
      tenantId: string,
      amountPaid: number,
    ) => ({
      id: eventId,
      object: 'event',
      type,
      data: {
        object: {
          id: invoiceId,
          object: 'invoice',
          amount_due: 4900,
          amount_paid: amountPaid,
          currency: 'usd',
          hosted_invoice_url: `https://stub.stripe.test/invoice/${invoiceId}`,
          invoice_pdf: null,
          period_start: null,
          period_end: null,
          parent: {
            subscription_details: {
              subscription: stripeSubscriptionId,
              metadata: { tenantId },
            },
          },
        },
      },
    });

    const invoiceIdA = `in_test_p5_a_${suffix}`;
    await signAndSend(
      invoiceEvent(
        `evt_p5_failed_a_${suffix}`,
        'invoice.payment_failed',
        invoiceIdA,
        stripeSubA,
        tenantAId,
        0,
      ),
    );

    const tenantAAfterFailure = await request(server)
      .get('/api/v1/tenants/me')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    expect(tenantAAfterFailure.body.status).toBe('past_due');

    const invoicesA = await request(server)
      .get('/api/v1/billing/invoices')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    const invoiceRowA = invoicesA.body.find(
      (i: { stripeInvoiceId: string }) => i.stripeInvoiceId === invoiceIdA,
    );
    expect(invoiceRowA).toBeDefined();
    expect(invoiceRowA.status).toBe('open');

    // Tenant B: same payment_failed → past_due, then invoice.paid recovers
    // it back to active — proves the OTHER half of the webhook dispatch
    // (recovery), fully inside apps/api, no worker process involved.
    const invoiceIdB = `in_test_p5_b_${suffix}`;
    await signAndSend(
      invoiceEvent(
        `evt_p5_failed_b_${suffix}`,
        'invoice.payment_failed',
        invoiceIdB,
        stripeSubB,
        tenantBId,
        0,
      ),
    );
    const tenantBPastDue = await request(server)
      .get('/api/v1/tenants/me')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    expect(tenantBPastDue.body.status).toBe('past_due');

    await signAndSend(
      invoiceEvent(
        `evt_p5_paid_b_${suffix}`,
        'invoice.paid',
        invoiceIdB,
        stripeSubB,
        tenantBId,
        4900,
      ),
    );
    const tenantBRecovered = await request(server)
      .get('/api/v1/tenants/me')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    expect(tenantBRecovered.body.status).toBe('active');

    const auditB = await request(server)
      .get(`/api/v1/tenants/${tenantBId}/audit-logs`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    expect(
      auditB.body.some(
        (l: { action: string; metadata: { reason?: string } }) =>
          l.action === 'tenant.status_change' &&
          l.metadata.reason === 'payment_recovered',
      ),
    ).toBe(true);
  });

  it('a deterministic dunning cycle: tenant A (already past_due from the previous test) is suspended once its grace period elapses, and its storefront 403s while its own dashboard stays reachable', async () => {
    // The grace-period-expiry transition itself lives in
    // apps/worker/src/processors/dunning.processor.ts, a separate process
    // this suite deliberately never boots or imports — every describe block
    // in this file is self-contained/no-external-process-dependency by
    // design (see the Phase 2 fixture's own comment). What follows mirrors
    // that processor's exact query + transition (same tenant.update +
    // SET LOCAL + auditLog.create shape, same action/metadata strings) to
    // deterministically prove the DB-side mechanics the real M32 manual
    // verification already exercised end-to-end through the actual worker.
    const gracePeriodDays = Number(process.env.DUNNING_GRACE_PERIOD_DAYS ?? 3);
    const prisma = createBasePrismaClient(process.env.DATABASE_URL_APP);
    try {
      // Back-date pastDueSince past the grace period — `tenants` has no RLS
      // policy (it IS the tenant), so this plain update needs no SET LOCAL,
      // same as DunningProcessor's own `tenant.update` call.
      const backdated = new Date(
        Date.now() - (gracePeriodDays + 1) * 24 * 60 * 60 * 1000,
      );
      await prisma.tenant.update({
        where: { id: tenantAId },
        data: { pastDueSince: backdated },
      });

      const cutoff = new Date(
        Date.now() - gracePeriodDays * 24 * 60 * 60 * 1000,
      );
      const overdue = await prisma.tenant.findMany({
        where: { status: 'past_due', pastDueSince: { lte: cutoff } },
      });
      expect(overdue.map((t) => t.id)).toContain(tenantAId);

      await prisma.$transaction(async (tx) => {
        await tx.tenant.update({
          where: { id: tenantAId },
          data: { status: 'suspended' },
        });
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantAId}'`);
        await tx.auditLog.create({
          data: {
            tenantId: tenantAId,
            actorUserId: null,
            action: 'tenant.status_change',
            metadata: {
              from: 'past_due',
              to: 'suspended',
              reason: 'dunning_grace_period_expired',
            },
          },
        });
      });
    } finally {
      await prisma.$disconnect();
    }

    const tenantAFinal = await request(server)
      .get('/api/v1/tenants/me')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    expect(tenantAFinal.body.status).toBe('suspended');

    const auditA = await request(server)
      .get(`/api/v1/tenants/${tenantAId}/audit-logs`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    expect(
      auditA.body.some(
        (l: { action: string; metadata: { reason?: string } }) =>
          l.action === 'tenant.status_change' &&
          l.metadata.reason === 'dunning_grace_period_expired',
      ),
    ).toBe(true);

    // Suspended tenant's storefront 403s (TENANT_SUSPENDED)...
    const storefront = await request(server)
      .get('/api/v1/storefront/products')
      .set('X-Tenant-Subdomain', subdomainA)
      .expect(403);
    expect(storefront.body.error.code).toBe('TENANT_SUSPENDED');

    // ...while its own staff dashboard remains reachable (JWT-derived tenant
    // context, no Host-header subdomain resolution — see this phase's plan
    // for why that's correct, load-bearing behavior, not a gap).
    await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
  });
});

/**
 * Phase 6 (round 1) extension — Custom Domains + Outbound Webhooks. Same
 * suite shape as Phases 2-5. Note the split isolation story:
 * `custom_domains` has NO RLS policy (a deliberate correction found during
 * M38 verification — see that model's schema.prisma comment: it must be
 * resolvable by `TenantResolverGuard` before any tenant context exists, the
 * same bootstrap problem `Tenant`/`Plan`/`Permission` solve the same way),
 * so its isolation proof is APP-LAYER (list/cross-tenant-404 checks), not a
 * raw RLS bypass — while `webhook_subscriptions`/`webhook_deliveries` DO
 * have RLS and get the standard direct-bypass proof every other
 * tenant-scoped table in this file gets. The actual webhook DELIVERY
 * mechanics (HMAC signing, retry, delivered/failed transitions) are covered
 * by `apps/worker/src/processors/webhook-delivery.processor.spec.ts` — this
 * suite only proves the DISPATCH side (a real checkout creates a real
 * `WebhookDelivery` row), consistent with this file's established
 * discipline of never booting apps/worker from an apps/api e2e test.
 */
describe('Tenant isolation (e2e) — Phase 6 custom domains & outbound webhooks', () => {
  let app: INestApplication;
  let server: import('http').Server;

  let tenantAId: string;
  let tenantBId: string;
  let subdomainA: string;
  let subdomainB: string;
  let ownerAToken: string;
  let ownerBToken: string;

  const suffix = randomBytes(4).toString('hex');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    server = app.getHttpServer();

    subdomainA = `iso-p6-a-${suffix}`;
    subdomainB = `iso-p6-b-${suffix}`;

    const regA = await request(server)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Isolation P6 A',
        subdomain: subdomainA,
        email: `owner-p6-a-${suffix}@example.com`,
        password: 'IsolationTest123!',
      })
      .expect(201);
    tenantAId = regA.body.tenantId;
    ownerAToken = regA.body.tokens.accessToken;

    const regB = await request(server)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Isolation P6 B',
        subdomain: subdomainB,
        email: `owner-p6-b-${suffix}@example.com`,
        password: 'IsolationTest123!',
      })
      .expect(201);
    tenantBId = regB.body.tenantId;
    ownerBToken = regB.body.tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sanity: the two registrations produced genuinely distinct tenants', () => {
    expect(tenantAId).not.toBe(tenantBId);
  });

  it("a tenant's custom domain never appears in another tenant's list, and a cross-tenant verify/remove 404s (app-layer isolation — custom_domains has no RLS)", async () => {
    const added = await request(server)
      .post('/api/v1/domains')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ domain: `iso-p6-domain-${suffix}.example` })
      .expect(201);
    const domainId = added.body.id;

    const listA = await request(server)
      .get('/api/v1/domains')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    expect(listA.body.map((d: { id: string }) => d.id)).toContain(domainId);

    const listB = await request(server)
      .get('/api/v1/domains')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    expect(listB.body.map((d: { id: string }) => d.id)).not.toContain(domainId);

    const crossVerify = await request(server)
      .post(`/api/v1/domains/${domainId}/verify`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(404);
    expect(crossVerify.body.error.code).toBe('RESOURCE_NOT_FOUND');

    const crossRemove = await request(server)
      .delete(`/api/v1/domains/${domainId}`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(404);
    expect(crossRemove.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('RLS blocks cross-tenant reads on webhook_subscriptions directly (bypasses Nest entirely)', async () => {
    const created = await request(server)
      .post('/api/v1/webhook-subscriptions')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        url: 'http://127.0.0.1:9/rls-proof',
        eventTypes: ['order.created'],
      })
      .expect(201);
    const subscriptionId = created.body.id;

    const prisma = createBasePrismaClient(process.env.DATABASE_URL_APP);
    try {
      const rows = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantBId}'`);
        return tx.webhookSubscription.findMany({
          where: { id: subscriptionId },
        });
      });
      expect(rows).toHaveLength(0);

      const rowsNoContext = await prisma.webhookSubscription.findMany({
        where: { id: subscriptionId },
      });
      expect(rowsNoContext).toHaveLength(0);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('TenantResolverGuard resolves a tenant via a verified custom domain (Host header only, no JWT/subdomain) and refuses an unverified one', async () => {
    const prisma = createBasePrismaClient(process.env.DATABASE_URL_APP);
    const fallbackDomain = `iso-p6-fallback-${suffix}.example`;
    try {
      const customDomain = await prisma.customDomain.create({
        data: {
          tenantId: tenantAId,
          domain: fallbackDomain,
          status: 'verified',
          verificationToken: 'fixture-token',
        },
      });

      const verified = await request(server)
        .get('/api/v1/storefront/products')
        .set('Host', fallbackDomain)
        .expect(200);
      expect(verified.body).toEqual([]); // tenant A has no published products in this suite — 200, not 404, is what matters here

      await prisma.customDomain.update({
        where: { id: customDomain.id },
        data: { status: 'pending_verification' },
      });

      const unverified = await request(server)
        .get('/api/v1/storefront/products')
        .set('Host', fallbackDomain)
        .expect(404);
      expect(unverified.body.error.code).toBe('TENANT_NOT_FOUND');

      await prisma.customDomain.delete({ where: { id: customDomain.id } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('a registered webhook subscription gets a real WebhookDelivery row after a real checkout (order.created dispatch)', async () => {
    const product = await request(server)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        name: 'Isolation P6 Product',
        slug: `iso-p6-product-${suffix}`,
        basePrice: 12,
        status: 'published',
        variant: { sku: `ISO-P6-SKU-${suffix}`, initialStock: 10 },
      })
      .expect(201);
    const variantId = product.body.variants[0].id;

    const zone = await request(server)
      .post('/api/v1/shipping-zones')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ name: 'Zone P6', regions: ['US'] })
      .expect(201);
    await request(server)
      .post(`/api/v1/shipping-zones/${zone.body.id}/rates`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ name: 'Flat', type: 'flat_rate', amount: 5 })
      .expect(201);

    await request(server)
      .post('/api/v1/payments/connect/onboard')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(201);

    const subscription = await request(server)
      .post('/api/v1/webhook-subscriptions')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        url: 'http://127.0.0.1:9/dispatch-proof',
        eventTypes: ['order.created'],
      })
      .expect(201);

    const customer = await request(server)
      .post('/api/v1/customers/register')
      .set('X-Tenant-Subdomain', subdomainA)
      .send({
        email: `cust-p6-${suffix}@example.com`,
        password: 'CustomerTest123!',
      })
      .expect(201);
    const customerToken = customer.body.tokens.accessToken;

    await request(server)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .send({ variantId, quantity: 1 })
      .expect(201);

    const checkout = await request(server)
      .post('/api/v1/checkout/complete')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .send({
        shippingAddress: {
          line1: '1 Test St',
          city: 'Testville',
          country: 'US',
        },
      })
      .expect(201);
    const orderId = checkout.body.order.id;

    const deliveries = await request(server)
      .get(`/api/v1/webhook-subscriptions/${subscription.body.id}/deliveries`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    const delivery = deliveries.body.find(
      (d: { eventType: string; payload: { orderId: string } }) =>
        d.eventType === 'order.created' && d.payload.orderId === orderId,
    );
    expect(delivery).toBeDefined();
    expect(delivery.status).toBe('pending'); // no worker process runs in this e2e suite — delivery mechanics are covered separately
  });
});

/**
 * Compliance extension — tenant data export & scheduled deletion
 * (FR-AU-03, NFR-CP-01/02). Same suite shape as Phase 5/6, with the same
 * Super Admin login dependency as the Phase 5 block (for the offboard
 * trigger). This suite proves the DISPATCH/API side only — the actual
 * export-file generation (real storage upload/download, field exclusions)
 * is covered by `apps/worker/src/processors/data-export.processor.spec.ts`,
 * consistent with this file's established discipline of never booting
 * apps/worker from an apps/api e2e test. The retention-deletion scenario
 * mirrors `DataRetentionProcessor`'s exact query + transition logic inline
 * (same technique the Phase 5 dunning test already established) rather than
 * invoking the real processor.
 */
describe('Tenant isolation (e2e) — Compliance data export & deletion', () => {
  let app: INestApplication;
  let server: import('http').Server;

  let tenantAId: string;
  let tenantBId: string;
  let subdomainA: string;
  let subdomainB: string;
  let ownerAToken: string;
  let ownerBToken: string;
  let superAdminToken: string;

  const suffix = randomBytes(4).toString('hex');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    server = app.getHttpServer();

    subdomainA = `iso-cp-a-${suffix}`;
    subdomainB = `iso-cp-b-${suffix}`;

    const regA = await request(server)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Isolation Compliance A',
        subdomain: subdomainA,
        email: `owner-cp-a-${suffix}@example.com`,
        password: 'IsolationTest123!',
      })
      .expect(201);
    tenantAId = regA.body.tenantId;
    ownerAToken = regA.body.tokens.accessToken;

    const regB = await request(server)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Isolation Compliance B',
        subdomain: subdomainB,
        email: `owner-cp-b-${suffix}@example.com`,
        password: 'IsolationTest123!',
      })
      .expect(201);
    tenantBId = regB.body.tenantId;
    ownerBToken = regB.body.tokens.accessToken;

    const superLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'superadmin@platform.test', password: 'Password123!' })
      .expect(201);
    superAdminToken = superLogin.body.tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sanity: the two registrations produced genuinely distinct tenants', () => {
    expect(tenantAId).not.toBe(tenantBId);
  });

  it('RLS blocks cross-tenant reads on data_export_requests directly (bypasses Nest entirely)', async () => {
    const created = await request(server)
      .post('/api/v1/tenants/me/export')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(201);
    const requestId = created.body.id;

    const prisma = createBasePrismaClient(process.env.DATABASE_URL_APP);
    try {
      const rows = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantBId}'`);
        return tx.dataExportRequest.findMany({ where: { id: requestId } });
      });
      expect(rows).toHaveLength(0);

      const rowsNoContext = await prisma.dataExportRequest.findMany({
        where: { id: requestId },
      });
      expect(rowsNoContext).toHaveLength(0);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("a tenant's own export requests are visible via the API, but never another tenant's", async () => {
    const listA = await request(server)
      .get('/api/v1/tenants/me/export')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    expect(listA.body.length).toBeGreaterThan(0); // from the previous test

    const listB = await request(server)
      .get('/api/v1/tenants/me/export')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    expect(listB.body).toEqual([]);
  });

  it('offboarding a tenant (Super Admin) auto-triggers an export request and sets offboardedAt', async () => {
    const before = await request(server)
      .get('/api/v1/tenants/me/export')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    expect(before.body).toEqual([]);

    const offboarded = await request(server)
      .patch(`/api/v1/tenants/${tenantBId}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'offboarded', reason: 'e2e compliance test' })
      .expect(200);
    expect(offboarded.body.status).toBe('offboarded');
    expect(offboarded.body.offboardedAt).not.toBeNull();

    const after = await request(server)
      .get('/api/v1/tenants/me/export')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .expect(200);
    expect(after.body.length).toBe(1);
    expect(after.body[0].status).toBe('pending');
  });

  it('a deterministic retention-deletion cycle: tenant B (already offboarded from the previous test) is permanently deleted once its retention period elapses', async () => {
    // Mirrors DataRetentionProcessor's exact query + transition logic
    // inline (same technique the Phase 5 dunning test already established)
    // — this suite never boots apps/worker; the real processor's own
    // behavior (including this exact scenario, triggered for real via a
    // real BullMQ job) was already proven in this feature's M47 manual
    // verification.
    const retentionDays = Number(process.env.DATA_RETENTION_DAYS ?? 30);
    const prisma = createBasePrismaClient(process.env.DATABASE_URL_APP);
    try {
      const backdated = new Date(
        Date.now() - (retentionDays + 1) * 24 * 60 * 60 * 1000,
      );
      await prisma.tenant.update({
        where: { id: tenantBId },
        data: { offboardedAt: backdated },
      });

      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const overdue = await prisma.tenant.findMany({
        where: { status: 'offboarded', offboardedAt: { lte: cutoff } },
      });
      expect(overdue.map((t) => t.id)).toContain(tenantBId);

      // Capture owner email BEFORE deleting — same discipline as the real
      // processor (nothing to look up once the tenant/its Users are gone).
      const owner = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantBId}'`);
        return tx.user.findFirst({ where: { tenantId: tenantBId } });
      });
      expect(owner?.email).toBe(`owner-cp-b-${suffix}@example.com`);

      await prisma.tenant.delete({ where: { id: tenantBId } });
    } finally {
      await prisma.$disconnect();
    }

    // Tenant B's own JWT is now for a tenant that no longer exists at all —
    // every route that resolves the tenant (even just `/auth/me`) should
    // fail cleanly, not 500.
    const afterDelete = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${ownerBToken}`);
    expect(afterDelete.status).toBeGreaterThanOrEqual(400);
    expect(afterDelete.status).toBeLessThan(500);
  });
});

/**
 * Public API — API-key authentication (M50-M54). Proves the round's core
 * claim for real: an `X-API-Key` header, with NO `Authorization` header at
 * all, authenticates identically to a JWT against the exact same,
 * pre-existing business endpoints — same RBAC, same tenant isolation, same
 * rejection behavior for a bad credential. `ApiKeyGuard`/`JwtAuthGuard`'s
 * skip-clause and `RbacGuard`'s credential-agnostic design are what make
 * this possible with zero changes to any controller (see api-key.guard.ts).
 */
describe('Tenant isolation (e2e) — Public API (API-key authentication)', () => {
  let app: INestApplication;
  let server: import('http').Server;

  let tenantAId: string;
  let tenantBId: string;
  let subdomainA: string;
  let subdomainB: string;
  let ownerAToken: string;
  let ownerAUserId: string;
  let staffRoleAId: string;

  const suffix = randomBytes(4).toString('hex');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    server = app.getHttpServer();

    subdomainA = `iso-ak-a-${suffix}`;
    subdomainB = `iso-ak-b-${suffix}`;

    const regA = await request(server)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Isolation ApiKey A',
        subdomain: subdomainA,
        email: `owner-ak-a-${suffix}@example.com`,
        password: 'IsolationTest123!',
      })
      .expect(201);
    tenantAId = regA.body.tenantId;
    ownerAToken = regA.body.tokens.accessToken;

    const regB = await request(server)
      .post('/api/v1/auth/register')
      .send({
        businessName: 'Isolation ApiKey B',
        subdomain: subdomainB,
        email: `owner-ak-b-${suffix}@example.com`,
        password: 'IsolationTest123!',
      })
      .expect(201);
    tenantBId = regB.body.tenantId;

    const meA = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    ownerAUserId = meA.body.user.id;

    const rolesA = await request(server)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(200);
    staffRoleAId = rolesA.body.find(
      (r: { name: string }) => r.name === 'staff',
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sanity: the two registrations produced genuinely distinct tenants', () => {
    expect(tenantAId).not.toBe(tenantBId);
  });

  it('POST /api-keys returns the plain key exactly once; GET /api-keys never leaks it', async () => {
    const created = await request(server)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .send({ name: 'e2e key' })
      .expect(201);
    expect(created.body.key).toMatch(/^sat_[0-9a-f]{48}$/);
    expect(created.body.keyHash).toBeUndefined();

    const list = await request(server)
      .get('/api/v1/api-keys')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .expect(200);
    const row = list.body.find((k: { id: string }) => k.id === created.body.id);
    expect(row).toBeDefined();
    expect(row.key).toBeUndefined();
    expect(row.keyHash).toBeUndefined();
    expect(row.keyPreview).toBe(created.body.key.slice(-4));
  });

  it('a REAL business endpoint (GET/POST /products) is fully usable with ONLY an X-API-Key header — no Authorization header at all', async () => {
    const created = await request(server)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .send({ name: 'products access key' })
      .expect(201);
    const apiKey = created.body.key;

    const listResp = await request(server)
      .get('/api/v1/products')
      .set('X-API-Key', apiKey)
      .set('X-Tenant-Subdomain', subdomainA)
      .expect(200);
    expect(Array.isArray(listResp.body)).toBe(true);

    const createResp = await request(server)
      .post('/api/v1/products')
      .set('X-API-Key', apiKey)
      .set('X-Tenant-Subdomain', subdomainA)
      .send({
        name: 'API Key Product',
        slug: `api-key-product-${suffix}`,
        basePrice: 9.99,
      })
      .expect(201);
    expect(createResp.body.tenantId).toBe(tenantAId);
  });

  it('cross-tenant isolation: tenant A key resolves only tenant A, and is rejected outright against tenant B', async () => {
    const created = await request(server)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .send({ name: 'cross-tenant test key' })
      .expect(201);
    const apiKey = created.body.key;

    // Mismatched Host-resolved tenant (B) vs. the key's own tenant (A).
    await request(server)
      .get('/api/v1/products')
      .set('X-API-Key', apiKey)
      .set('X-Tenant-Subdomain', subdomainB)
      .expect(403);

    // No tenant signal at all — the key alone resolves tenant A, never B.
    const noHeader = await request(server)
      .get('/api/v1/products')
      .set('X-API-Key', apiKey)
      .expect(200);
    expect(
      noHeader.body.every(
        (p: { tenantId: string }) => p.tenantId === tenantAId,
      ),
    ).toBe(true);
  });

  it('a revoked or bogus API key is rejected with 401, never a 500', async () => {
    const created = await request(server)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .send({ name: 'to be revoked' })
      .expect(201);

    await request(server)
      .delete(`/api/v1/api-keys/${created.body.id}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .expect(204);

    await request(server)
      .get('/api/v1/products')
      .set('X-API-Key', created.body.key)
      .expect(401);

    await request(server)
      .get('/api/v1/products')
      .set('X-API-Key', 'sat_totallybogus0000000000000000000000000000000000')
      .expect(401);
  });

  it("RBAC applies to the key's owning user in real time — downgrading that user's role immediately narrows what its existing key can do", async () => {
    const created = await request(server)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .send({ name: 'rbac test key' })
      .expect(201);
    const apiKey = created.body.key;

    // Still owner-tier: write access works.
    await request(server)
      .post('/api/v1/products')
      .set('X-API-Key', apiKey)
      .set('X-Tenant-Subdomain', subdomainA)
      .send({
        name: 'Pre-downgrade product',
        slug: `pre-downgrade-${suffix}`,
        basePrice: 1,
      })
      .expect(201);

    await request(server)
      .patch(`/api/v1/users/${ownerAUserId}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .send({ roleId: staffRoleAId })
      .expect(200);

    // staff has products.view but not products.manage — same key, no
    // re-creation, permissions re-resolved fresh every request.
    await request(server)
      .get('/api/v1/products')
      .set('X-API-Key', apiKey)
      .set('X-Tenant-Subdomain', subdomainA)
      .expect(200);

    await request(server)
      .post('/api/v1/products')
      .set('X-API-Key', apiKey)
      .set('X-Tenant-Subdomain', subdomainA)
      .send({
        name: 'Post-downgrade product',
        slug: `post-downgrade-${suffix}`,
        basePrice: 1,
      })
      .expect(403);
  });

  it('normal JWT-authenticated requests (no X-API-Key header) are completely unaffected', async () => {
    const resp = await request(server)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .set('X-Tenant-Subdomain', subdomainA)
      .expect(200);
    expect(Array.isArray(resp.body)).toBe(true);
  });
});
