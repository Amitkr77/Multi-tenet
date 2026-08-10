import { NotFoundException } from '@nestjs/common';
import { PlansService } from './plans.service';

function makeService(overrides: Record<string, any> = {}) {
  const tx = {
    plan: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'plan-1', limits: [] }),
      update: jest.fn().mockResolvedValue({ id: 'plan-1', limits: [] }),
    },
    planLimit: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides.tx,
  };

  const prisma = {
    base: {
      plan: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'plan-1', archivedAt: new Date() }),
      },
      $transaction: jest.fn((fn: (tx: any) => any) => fn(tx)),
      ...overrides.base,
    },
  };
  return { service: new PlansService(prisma as any), prisma, tx };
}

describe('PlansService', () => {
  describe('getById', () => {
    it('returns the plan when found', async () => {
      const plan = { id: 'plan-1', name: 'Free', limits: [] };
      const { service, prisma } = makeService();
      prisma.base.plan.findUnique.mockResolvedValue(plan);
      await expect(service.getById('plan-1')).resolves.toEqual(plan);
    });

    it('throws NotFoundException when plan does not exist', async () => {
      const { service } = makeService();
      await expect(service.getById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = {
      name: 'Pro',
      price: 49,
      billingInterval: 'month' as const,
      stripePriceId: 'price_abc',
      isDefault: false,
      limits: [],
    };

    it('creates a plan without touching isDefault when isDefault is false', async () => {
      const { service, tx } = makeService();
      await service.create(dto);
      expect(tx.plan.updateMany).not.toHaveBeenCalled();
      expect(tx.plan.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Pro' }) }),
      );
    });

    it('clears existing default plans before setting the new default', async () => {
      const { service, tx } = makeService();
      await service.create({ ...dto, isDefault: true });
      expect(tx.plan.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false },
      });
      expect(tx.plan.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const dto = {
      name: 'Pro v2',
      price: 59,
      billingInterval: 'month' as const,
      stripePriceId: 'price_xyz',
      isDefault: false,
    };

    it('throws NotFoundException when the plan to update does not exist', async () => {
      const { service } = makeService();
      // getById internally calls findUnique — leave it returning null
      await expect(service.update('missing', dto)).rejects.toThrow(NotFoundException);
    });

    it('replaces limits when dto.limits is provided', async () => {
      const existing = { id: 'plan-1', limits: [] };
      const { service, prisma, tx } = makeService();
      prisma.base.plan.findUnique.mockResolvedValue(existing);
      await service.update('plan-1', { ...dto, limits: [{ metric: 'staff_seats', maxValue: 5 }] });
      expect(tx.planLimit.deleteMany).toHaveBeenCalledWith({ where: { planId: 'plan-1' } });
    });

    it('does NOT delete limits when dto.limits is absent', async () => {
      const existing = { id: 'plan-1', limits: [] };
      const { service, prisma, tx } = makeService();
      prisma.base.plan.findUnique.mockResolvedValue(existing);
      await service.update('plan-1', dto);
      expect(tx.planLimit.deleteMany).not.toHaveBeenCalled();
    });

    it('clears other defaults when isDefault becomes true', async () => {
      const existing = { id: 'plan-1', limits: [] };
      const { service, prisma, tx } = makeService();
      prisma.base.plan.findUnique.mockResolvedValue(existing);
      await service.update('plan-1', { ...dto, isDefault: true });
      expect(tx.plan.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true, NOT: { id: 'plan-1' } },
        data: { isDefault: false },
      });
    });
  });

  describe('archive', () => {
    it('soft-archives the plan by setting archivedAt', async () => {
      const existing = { id: 'plan-1', limits: [] };
      const { service, prisma } = makeService();
      prisma.base.plan.findUnique.mockResolvedValue(existing);
      const result = await service.archive('plan-1');
      expect(prisma.base.plan.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ archivedAt: expect.any(Date) }) }),
      );
      expect(result.archivedAt).toBeInstanceOf(Date);
    });

    it('throws NotFoundException when archiving a non-existent plan', async () => {
      const { service } = makeService();
      await expect(service.archive('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
