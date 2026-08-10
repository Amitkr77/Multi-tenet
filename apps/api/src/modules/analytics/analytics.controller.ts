import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  analyticsExportQuerySchema,
  dateRangeQuerySchema,
} from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodQuery } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { AnalyticsService } from './analytics.service';

/**
 * Every route here is gated by `analytics.view` — including export's
 * literal "Staff+" spec annotation, which only describes the route's
 * minimum auth tier, not the real gate. `/analytics/export` (added in M25)
 * additionally requires `analytics.export`, which staff does NOT have per
 * packages/database/src/permissions.ts — proven by an explicit e2e
 * assertion (M28), not just this comment.
 */
@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @ZodQuery(dateRangeQuerySchema)
  @Get('revenue')
  @RequirePermissions('analytics.view')
  revenue(
    @CurrentTenantId() tenantId: string,
    @Query(new ZodValidationPipe(dateRangeQuerySchema)) query: any,
  ) {
    return this.analyticsService.revenue(tenantId, query);
  }

  @ZodQuery(dateRangeQuerySchema)
  @Get('orders')
  @RequirePermissions('analytics.view')
  orders(
    @CurrentTenantId() tenantId: string,
    @Query(new ZodValidationPipe(dateRangeQuerySchema)) query: any,
  ) {
    return this.analyticsService.orders(tenantId, query);
  }

  @ZodQuery(dateRangeQuerySchema)
  @Get('products/best-sellers')
  @RequirePermissions('analytics.view')
  bestSellers(
    @CurrentTenantId() tenantId: string,
    @Query(new ZodValidationPipe(dateRangeQuerySchema)) query: any,
  ) {
    return this.analyticsService.bestSellers(tenantId, query);
  }

  @ZodQuery(dateRangeQuerySchema)
  @Get('customers')
  @RequirePermissions('analytics.view')
  customers(
    @CurrentTenantId() tenantId: string,
    @Query(new ZodValidationPipe(dateRangeQuerySchema)) query: any,
  ) {
    return this.analyticsService.customers(tenantId, query);
  }

  @ZodQuery(dateRangeQuerySchema)
  @Get('inventory')
  @RequirePermissions('analytics.view')
  inventory(
    @CurrentTenantId() tenantId: string,
    @Query(new ZodValidationPipe(dateRangeQuerySchema)) query: any,
  ) {
    return this.analyticsService.inventory(tenantId, query);
  }

  /**
   * Gated by `analytics.export` specifically — NOT just `analytics.view`.
   * Staff has `analytics.view` but not `analytics.export` (see
   * packages/database/src/permissions.ts), so this route 403s for staff
   * while every other /analytics/* route above 200s for them — proven by
   * an explicit e2e assertion (M28), not just this comment.
   */
  @ZodQuery(analyticsExportQuerySchema)
  @Get('export')
  @RequirePermissions('analytics.export')
  async export(
    @CurrentTenantId() tenantId: string,
    @Query(new ZodValidationPipe(analyticsExportQuerySchema)) query: any,
    @Res() res: Response,
  ) {
    const { contentType, filename, body } = await this.analyticsService.export(
      tenantId,
      query,
    );
    // NOT `@Res({ passthrough: true })` + `return body` — Nest's default
    // response handling treats a returned Buffer as a plain object and
    // JSON-serializes it (`{"type":"Buffer","data":[...]}`) rather than
    // sending raw bytes, corrupting the PDF. Taking over the response
    // directly with `res.send()` is what actually streams binary bytes.
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  }
}
