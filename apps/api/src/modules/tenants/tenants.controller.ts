import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { updateTenantSchema } from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  @RequirePermissions('settings.view')
  getMe(@CurrentTenantId() tenantId: string) {
    return this.tenantsService.getById(tenantId);
  }

  @ZodBody(updateTenantSchema)
  @Patch('me')
  @RequirePermissions('settings.manage')
  updateMe(
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(updateTenantSchema)) dto: any,
  ) {
    return this.tenantsService.updateOwnProfile(tenantId, dto);
  }

  /**
   * FR-AU-02 ("Tenant Owner/Admin can view their own tenant's audit log")
   * has no endpoint in the original 06-api-specification.md — that doc only
   * lists the Super Admin cross-tenant route (`/tenants/:id/audit-logs`).
   * Added here, gated by the same `audit_log.view` permission the matrix
   * already grants Owner/Admin (03-roles-permission-matrix.md), closing the
   * gap without touching the Super Admin route.
   */
  @Get('me/audit-logs')
  @RequirePermissions('audit_log.view')
  getMyAuditLogs(@CurrentTenantId() tenantId: string) {
    return this.tenantsService.listAuditLogs(tenantId);
  }

  /** FR-AU-03 / NFR-CP-01 — data portability, available on request, independent of offboarding. */
  @Post('me/export')
  @RequirePermissions('compliance.manage')
  requestExport(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tenantsService.requestExport(tenantId, user.userId);
  }

  @Get('me/export')
  @RequirePermissions('compliance.manage')
  listExportRequests(@CurrentTenantId() tenantId: string) {
    return this.tenantsService.listExportRequests(tenantId);
  }
}
