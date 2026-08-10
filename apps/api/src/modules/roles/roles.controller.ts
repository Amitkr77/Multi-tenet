import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createRoleSchema, updateRoleSchema } from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { RolesService } from './roles.service';

@ApiTags('Users & Roles')
@Controller('roles')
@RequirePermissions('team.manage')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.rolesService.list(tenantId);
  }

  @ZodBody(createRoleSchema)
  @Post()
  create(
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(createRoleSchema)) dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.create(tenantId, dto, user.userId);
  }

  @ZodBody(updateRoleSchema)
  @Patch(':id')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRoleSchema)) dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.update(tenantId, id, dto, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.rolesService.remove(tenantId, id, user.userId);
  }
}

/** GET /permissions — 06-api-specification.md §3. Any authenticated tenant member may list the catalogue (read-only, no mutation). */
@ApiTags('Users & Roles')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  list() {
    return this.rolesService.listPermissionCatalogue();
  }
}
