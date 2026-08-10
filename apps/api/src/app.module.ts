import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { TenantThrottlerGuard } from './common/guards/tenant-throttler.guard';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CustomersModule } from './modules/customers/customers.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { TaxModule } from './modules/tax/tax.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { CartModule } from './modules/cart/cart.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PlansModule } from './modules/plans/plans.module';
import { BillingModule } from './modules/billing/billing.module';
import { DomainsModule } from './modules/domains/domains.module';
import { WebhookSubscriptionsModule } from './modules/webhook-subscriptions/webhook-subscriptions.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { TenantResolverGuard } from './common/guards/tenant-resolver.guard';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RbacGuard } from './common/guards/rbac.guard';
import { PlanLimitGuard } from './common/guards/plan-limit.guard';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { HttpMetricsInterceptor } from './common/interceptors/http-metrics.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    LoggerModule.forRoot({
      pinoHttp: {
        // JSON in prod (log-shipper friendly); pretty-printed locally —
        // same dev-shaped-now/prod-shaped-later split as the rest of this
        // codebase (X-Tenant-Subdomain dev header, etc.).
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        // Correlates client-supplied request ids (e.g. from an upstream
        // proxy) or mints a fresh one; echoed back so callers can log it too.
        genReqId: (
          req: { headers: Record<string, unknown> },
          res: { setHeader: (k: string, v: string) => void },
        ) => {
          const existing = req.headers['x-request-id'];
          const id = typeof existing === 'string' ? existing : randomUUID();
          res.setHeader('X-Request-Id', id);
          return id;
        },
        // Secrets must never hit logs.
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
      },
    }),
    // NFR-SE-06 — per-route overrides live on sensitive endpoints. Limit/ttl
    // are env-overridable (defaults unchanged) so a load-test run against a
    // single benchmarking client (one IP, by definition sharing one bucket)
    // can raise the ceiling without touching real per-IP protection in any
    // other environment — see infra/load-test/README.md.
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 100),
      },
    ]),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    PrismaModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    RolesModule,
    ProductsModule,
    InventoryModule,
    CustomersModule,
    HealthModule,
    MetricsModule,
    ShippingModule,
    TaxModule,
    CouponsModule,
    CartModule,
    PaymentsModule,
    OrdersModule,
    CheckoutModule,
    WebhooksModule,
    ReviewsModule,
    AnalyticsModule,
    PlansModule,
    BillingModule,
    DomainsModule,
    WebhookSubscriptionsModule,
    ApiKeysModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Order matters: resolve tenant from Host header first, THEN verify the
    // JWT (which cross-checks/adopts that tenant — see jwt-auth.guard.ts),
    // THEN (Phase 1 M4) RBAC. ThrottlerGuard is independent of tenant/auth.
    { provide: APP_GUARD, useClass: TenantThrottlerGuard },
    { provide: APP_GUARD, useClass: TenantResolverGuard },
    // Public API — API-key auth. Runs after tenant resolution, before JWT:
    // if a request carries a valid `X-API-Key`, this guard fully
    // authenticates it (setting the exact same `request.user`/
    // `request.tenantId` a JWT would) and JwtAuthGuard skips its own logic
    // entirely (see that guard's own one-line check). Absent header = pure
    // no-op, zero effect on existing JWT-authenticated traffic.
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_GUARD, useClass: PlanLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
