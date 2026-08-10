import { ShippingService } from './shipping.service';

/**
 * Direct unit test of the calculation logic (no NestJS TestingModule/DI
 * needed — PrismaService is just a constructor param) — same "service logic,
 * not framework wiring" scope as the checkpoint in the M15 plan.
 */
describe('ShippingService#calculateShippingCost', () => {
  function makeService(zones: any[]) {
    const prisma = {
      client: {
        shippingZone: { findMany: jest.fn().mockResolvedValue(zones) },
      },
    };
    return new ShippingService(prisma as any);
  }

  it('picks the cheapest flat_rate in the matching zone', async () => {
    const service = makeService([
      {
        regions: ['US'],
        rates: [
          {
            id: 'r1',
            name: 'Standard',
            type: 'flat_rate',
            amount: '9.99',
            freeAboveAmount: null,
          },
          {
            id: 'r2',
            name: 'Economy',
            type: 'flat_rate',
            amount: '4.99',
            freeAboveAmount: null,
          },
        ],
      },
    ]);
    const quote = await service.calculateShippingCost(
      't1',
      { country: 'US' },
      20,
    );
    expect(quote).toEqual({ amount: 4.99, rateId: 'r2', rateName: 'Economy' });
  });

  it('returns free (0) once the subtotal clears a free_above_threshold rate', async () => {
    const service = makeService([
      {
        regions: ['US'],
        rates: [
          {
            id: 'r1',
            name: 'Standard',
            type: 'flat_rate',
            amount: '9.99',
            freeAboveAmount: null,
          },
          {
            id: 'r2',
            name: 'Free over $50',
            type: 'free_above_threshold',
            amount: '0',
            freeAboveAmount: '50',
          },
        ],
      },
    ]);
    const quote = await service.calculateShippingCost(
      't1',
      { country: 'US' },
      75,
    );
    expect(quote).toEqual({
      amount: 0,
      rateId: 'r2',
      rateName: 'Free over $50',
    });
  });

  it('does not apply free_above_threshold below its threshold — falls back to flat_rate', async () => {
    const service = makeService([
      {
        regions: ['US'],
        rates: [
          {
            id: 'r1',
            name: 'Standard',
            type: 'flat_rate',
            amount: '9.99',
            freeAboveAmount: null,
          },
          {
            id: 'r2',
            name: 'Free over $50',
            type: 'free_above_threshold',
            amount: '0',
            freeAboveAmount: '50',
          },
        ],
      },
    ]);
    const quote = await service.calculateShippingCost(
      't1',
      { country: 'US' },
      20,
    );
    expect(quote).toEqual({ amount: 9.99, rateId: 'r1', rateName: 'Standard' });
  });

  it('matches a COUNTRY-STATE composite region', async () => {
    const service = makeService([
      {
        regions: ['CA-BC'],
        rates: [
          {
            id: 'r1',
            name: 'BC Rate',
            type: 'flat_rate',
            amount: '12.00',
            freeAboveAmount: null,
          },
        ],
      },
    ]);
    const quote = await service.calculateShippingCost(
      't1',
      { country: 'CA', state: 'BC' },
      20,
    );
    expect(quote?.rateId).toBe('r1');
  });

  it('returns null when no zone matches the address', async () => {
    const service = makeService([
      {
        regions: ['CA'],
        rates: [
          {
            id: 'r1',
            name: 'x',
            type: 'flat_rate',
            amount: '1',
            freeAboveAmount: null,
          },
        ],
      },
    ]);
    const quote = await service.calculateShippingCost(
      't1',
      { country: 'US' },
      20,
    );
    expect(quote).toBeNull();
  });
});
