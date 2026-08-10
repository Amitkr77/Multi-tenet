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
import { createApiKeySchema } from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ApiKeysService } from './api-keys.service';

@ApiTags('Api Keys')
@Controller('api-keys')
@RequirePermissions('api_keys.manage')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.apiKeysService.list(tenantId);
  }

  @ZodBody(createApiKeySchema)
  @Post()
  create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createApiKeySchema)) dto: any,
  ) {
    return this.apiKeysService.create(tenantId, user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    await this.apiKeysService.revoke(tenantId, id);
  }
}
