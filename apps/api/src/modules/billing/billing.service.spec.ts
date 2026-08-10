import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BillingService } from './billing.service';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makePlan(overrides: Record<string, any> = {}): any {
  return {
    id: 'plan-pro',
    name: 'Pro',
    price: 49,
    stripePriceId: 'price_pro',
    archivedAt: null,
    limits: [],
    ...overrides,
  };
}

function makeSubscription(overrides: Record<string, any> = {}): any {
  return {
    tenantId: 't1',
    planId: 'plan-free',
    stripeCustomerId: 'cus_existing',
    stripeSubscriptionId: 'sub_existing',
    status: 'active',
    ...overrides,
  };
}

function makeService(opts: {
  plan?: any | null;
  subscription?: any | null;
  currentUsage?: Record<string, number>;
}) {
  const plan = opts.plan !== undefined ? opts.plan : makePlan();
  const subscription = opts.subscription !== undefined ? opts.subscription : makeSubscription();
  const usage = opts.currentUsage ?? {};

  const tenant = { id: 't1', name: 'Acme Inc' };
  const owner = { id: 'user-1', email: 'owner@acme.com' };

  // PlanLimitGuard#resolveEffectiveLimit — called by getCurrentPlanAndUsage
  const planLimitGuard = {
    resolveEffectiveLimit: jest.fn().mockResolvedValue(999),
  };

  const stripeSubscription = { id: 'sub_new', status: 'active', current_period_end: null };
  const stripeService = {
    createCustomer: jest.fn().mockResolvedValue({ id: 'cus_new' }),
    upsertSubscription: jest.fn().mockResolvedValue(stripeSubscription),
  };

  const prisma = {
    base: {
      plan: {
        findUnique: jest.fn().mockResolvedValue(plan),
      },
    },
    client: {
      subscription: {
        findUnique: jest.fn().mockResolvedValue(subscription),
        update: jest.fn().mockImplementation(({ data }: any) => ({
          ...subscription,
          ...data,
        })),
      },
      tenant: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(tenant),
        update: jest.fn().mockResolvedValue(tenant),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(owner),
        count: jest.fn().mockResolvedValue(usage.staff_seats ?? 0),
      },
      product: {
        count: jest.fn().mockResolvedValue(usage.product_count ?? 0),
      },
      usageCounter: {
        findUnique: jest.fn().mockResolvedValue(
          usage.order_volume != null ? { count: usage.order_volume } : null,
        ),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    },
  };

  return {
    service: new BillingService(prisma as any, planLimitGuard as any, stripeService as any),
    prisma,
    stripeService,
  };
}

// ─── upgrade ─────────────────────────────────────────────────────────────────

describe('BillingService#upgrade', () => {
  it('throws BadRequestException when target plan does not exist', async () => {
    const { service } = makeService({ plan: null });
    await expect(
      service.upgrade('t1', { planId: 'plan-missing' }, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when target plan is archived', async () => {
    const { service } = makeService({ plan: makePlan({ archivedAt: new Date() }) });
    await expect(
      service.upgrade('t1', { planId: 'plan-pro' }, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when tenant has no subscription', async () => {
    const { service } = makeService({ subscription: null });
    await expect(
      service.upgrade('t1', { planId: 'plan-pro' }, 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws DOWNGRADE_BLOCKED when staff_seats usage exceeds target plan limit', async () => {
    const plan = makePlan({
      limits: [{ metric: 'staff_seats', maxValue: 2 }],
    });
    const { service } = makeService({ plan, currentUsage: { staff_seats: 5 } });
    await expect(
      service.upgrade('t1', { planId: 'plan-pro' }, 'user-1'),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.upgrade('t1', { planId: 'plan-pro' }, 'user-1'),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'DOWNGRADE_BLOCKED' }) });
  });

  it('throws DOWNGRADE_BLOCKED when product_count usage exceeds target plan limit', async () => {
    const plan = makePlan({
      limits: [{ metric: 'product_count', maxValue: 10 }],
    });
    const { service } = makeService({ plan, currentUsage: { product_count: 25 } });
    await expect(
      service.upgrade('t1', { planId: 'plan-pro' }, 'user-1'),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'DOWNGRADE_BLOCKED' }) });
  });

  it('does NOT block when usage is within the target plan limits', async () => {
    const plan = makePlan({
      limits: [
        { metric: 'staff_seats', maxValue: 10 },
        { metric: 'product_count', maxValue: 100 },
      ],
    });
    const { service } = makeService({
      plan,
      currentUsage: { staff_seats: 3, product_count: 50 },
    });
    await expect(
      service.upgrade('t1', { planId: 'plan-pro' }, 'user-1'),
    ).resolves.toBeDefined();
  });

  it('creates a new Stripe customer when stripeCustomerId is absent', async () => {
    const sub = makeSubscription({ stripeCustomerId: null, stripeSubscriptionId: null });
    const { service, stripeService } = makeService({ subscription: sub });
    await service.upgrade('t1', { planId: 'plan-pro' }, 'user-1');
    expect(stripeService.createCustomer).toHaveBeenCalledWith(
      't1',
      'owner@acme.com',
      'Acme Inc',
    );
  });

  it('reuses existing Stripe customer when stripeCustomerId is already set', async () => {
    const { service, stripeService } = makeService({});
    await service.upgrade('t1', { planId: 'plan-pro' }, 'user-1');
    expect(stripeService.createCustomer).not.toHaveBeenCalled();
  });

  it('calls upsertSubscription with the correct priceId and existing subscriptionId', async () => {
    const { service, stripeService } = makeService({});
    await service.upgrade('t1', { planId: 'plan-pro' }, 'user-1');
    expect(stripeService.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: 'price_pro',
        existingSubscriptionId: 'sub_existing',
      }),
    );
  });

  it('updates tenant.currentPlanId after a successful upgrade', async () => {
    const { service, prisma } = makeService({});
    await service.upgrade('t1', { planId: 'plan-pro' }, 'user-1');
    expect(prisma.client.tenant.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { currentPlanId: 'plan-pro' },
    });
  });
});

// ─── listInvoices ─────────────────────────────────────────────────────────────

describe('BillingService#listInvoices', () => {
  it('returns invoices ordered by createdAt desc', async () => {
    const invoices = [{ id: 'inv-1' }, { id: 'inv-2' }];
    const { service, prisma } = makeService({});
    prisma.client.invoice.findMany.mockResolvedValue(invoices);
    const result = await service.listInvoices('t1');
    expect(result).toEqual(invoices);
    expect(prisma.client.invoice.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't1' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
