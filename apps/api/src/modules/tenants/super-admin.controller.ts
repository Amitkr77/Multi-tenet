import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  paginationQuerySchema,
  updateTenantStatusSchema,
  planOverrideSchema,
} from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody, ZodQuery } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { TenantsService } from './tenants.service';

/**
 * All routes here require `platform.super_admin` — resolved the same way as
 * any other permission (RbacGuard checks the caller's roles under their
 * *current* tenant context, which for the Super Admin is null — see
 * permissions.ts's `super_admin` role). No separate "is this Super Admin"
 * mechanism needed.
 *
 * ORDERING NOTE: Fixed-path routes (/platform-stats, /platform-activity) must
 * be registered before parameterized routes (/:id) so NestJS doesn't swallow
 * them as if they were tenant IDs.
 */
@ApiTags('Tenants')
@Controller('tenants')
@RequirePermissions('platform.super_admin')
export class SuperAdminController {
  constructor(private readonly tenantsService: TenantsService) {}

  @ZodQuery(paginationQuerySchema)
  @Get()
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) query: any): Promise<any> {
    return this.tenantsService.listAll(query.page, query.limit);
  }

  /** Aggregate counts + MRR — no :id param so must come before /:id. */
  @Get('platform-stats')
  platformStats() {
    return this.tenantsService.platformStats();
  }

  /** Recent audit log entries across all tenants — must come before /:id. */
  @Get('platform-activity')
  platformActivity(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<any[]> {
    return this.tenantsService.platformActivity(limit);
  }

  @Get(':id')
  getOne(@Param('id') id: string): Promise<any> {
    return this.tenantsService.getById(id);
  }

  @ZodBody(updateTenantStatusSchema)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTenantStatusSchema)) dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tenantsService.updateStatus(id, dto, user.userId);
  }

  /** Directly assign a plan to a tenant (bypasses Stripe — admin action only). */
  @Patch(':id/plan')
  assignPlan(
    @Param('id') id: string,
    @Body('planId') planId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    return this.tenantsService.assignPlan(id, planId, user.userId);
  }

  @Get(':id/audit-logs')
  auditLogs(@Param('id') id: string) {
    return this.tenantsService.listAuditLogs(id);
  }

  @Post(':id/impersonate')
  impersonate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tenantsService.impersonate(id, user.userId);
  }

  // FR-P-08 / TENANT_PLAN_OVERRIDE — Phase 5.
  @ZodBody(planOverrideSchema)
  @Post(':id/plan-override')
  createPlanOverride(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(planOverrideSchema)) dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tenantsService.createPlanOverride(id, dto, user.userId);
  }

  @Get(':id/plan-override')
  listPlanOverrides(@Param('id') id: string) {
    return this.tenantsService.listPlanOverrides(id);
  }
}
