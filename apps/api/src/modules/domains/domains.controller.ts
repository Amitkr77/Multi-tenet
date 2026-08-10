import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { addDomainSchema } from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { DomainsService } from './domains.service';

/**
 * Reuses the existing `settings.manage` permission ("Store profile/
 * branding, custom domain setup" — packages/database/src/permissions.ts) —
 * no new permission code needed for this feature, unlike webhook
 * subscriptions (see webhook-subscriptions.controller.ts).
 */
@ApiTags('Domains')
@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  @RequirePermissions('settings.manage')
  list(@CurrentTenantId() tenantId: string) {
    return this.domainsService.list(tenantId);
  }

  @ZodBody(addDomainSchema)
  @Post()
  @RequirePermissions('settings.manage')
  create(
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(addDomainSchema)) dto: any,
  ) {
    return this.domainsService.create(tenantId, dto);
  }

  @Post(':id/verify')
  @RequirePermissions('settings.manage')
  verify(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.domainsService.verify(tenantId, id);
  }

  @Delete(':id')
  @RequirePermissions('settings.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    await this.domainsService.remove(tenantId, id);
  }
}
