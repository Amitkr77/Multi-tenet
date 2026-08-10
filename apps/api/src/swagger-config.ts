import { DocumentBuilder } from '@nestjs/swagger';

/**
 * Factored out of main.ts (rather than defined inline there) so
 * `test/openapi.e2e-spec.ts` (M-O6) can import it directly — importing
 * main.ts itself would also trigger its unconditional `bootstrap()` call
 * (real `app.listen()` and all), which a test must never do.
 */
export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Multi-Tenant SaaS Platform API')
    .setDescription(
      '06-api-specification.md, generated from NestJS decorators (NFR-M-04)',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth')
    .addTag('Tenants')
    .addTag('Users & Roles')
    .addTag('Products')
    .addTag('Storefront')
    .addTag('Inventory')
    .addTag('Customers')
    .addTag('Health')
    .addTag('Shipping & Tax')
    .addTag('Coupons')
    .addTag('Cart')
    .addTag('Checkout')
    .addTag('Orders')
    .addTag('Payments')
    .addTag('Reviews')
    .addTag('Analytics')
    .addTag('Plans')
    .addTag('Billing')
    .addTag('Domains')
    .addTag('Webhook Subscriptions')
    .build();
}
