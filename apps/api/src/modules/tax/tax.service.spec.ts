import { TaxService } from './tax.service';

describe('TaxService#calculateTax', () => {
  function makeService(rules: any[]) {
    const prisma = {
      client: { taxRule: { findMany: jest.fn().mockResolvedValue(rules) } },
    };
    return new TaxService(prisma as any);
  }

  it('applies a matching region-wide rate', async () => {
    const service = makeService([
      { region: 'US', rate: '8.25', categoryId: null },
    ]);
    const tax = await service.calculateTax('t1', { country: 'US' }, 100, []);
    expect(tax).toBe(8.25);
  });

  it('returns 0 when no rule matches the region', async () => {
    const service = makeService([
      { region: 'CA', rate: '5', categoryId: null },
    ]);
    const tax = await service.calculateTax('t1', { country: 'US' }, 100, []);
    expect(tax).toBe(0);
  });

  it('prefers a category-restricted rule over a region-wide one when the cart is entirely that category', async () => {
    const service = makeService([
      { region: 'US', rate: '8.25', categoryId: null },
      { region: 'US', rate: '15', categoryId: 'cat-alcohol' },
    ]);
    const tax = await service.calculateTax('t1', { country: 'US' }, 100, [
      'cat-alcohol',
    ]);
    expect(tax).toBe(15);
  });

  it('skips a category-restricted rule when the cart contains other categories', async () => {
    const service = makeService([
      { region: 'US', rate: '8.25', categoryId: null },
      { region: 'US', rate: '15', categoryId: 'cat-alcohol' },
    ]);
    const tax = await service.calculateTax('t1', { country: 'US' }, 100, [
      'cat-alcohol',
      'cat-other',
    ]);
    expect(tax).toBe(8.25);
  });

  it('matches a COUNTRY-STATE composite region', async () => {
    const service = makeService([
      { region: 'US-CA', rate: '10', categoryId: null },
    ]);
    const tax = await service.calculateTax(
      't1',
      { country: 'US', state: 'CA' },
      100,
      [],
    );
    expect(tax).toBe(10);
  });
});
