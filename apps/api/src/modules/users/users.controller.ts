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
import {
  inviteUserSchema,
  updateUserSchema,
  acceptInviteSchema,
} from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { EnforcePlanLimit } from '../../common/decorators/enforce-plan-limit.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from './users.service';

@ApiTags('Users & Roles')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
  ) {}

  @Get()
  @RequirePermissions('team.manage')
  list(@CurrentTenantId() tenantId: string) {
    return this.usersService.list(tenantId);
  }

  @ZodBody(inviteUserSchema)
  @Post('invite')
  @RequirePermissions('team.manage')
  @EnforcePlanLimit('staff_seats')
  async invite(
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(inviteUserSchema)) dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const tenant = await this.tenantsService.getById(tenantId);
    return this.usersService.invite(tenantId, tenant.name, dto, user.userId);
  }

  @Public()
  @ZodBody(acceptInviteSchema)
  @Post('accept-invite')
  @HttpCode(HttpStatus.NO_CONTENT)
  async acceptInvite(
    @Body(new ZodValidationPipe(acceptInviteSchema)) dto: any,
  ) {
    await this.usersService.acceptInvite(dto);
  }

  @ZodBody(updateUserSchema)
  @Patch(':id')
  @RequirePermissions('team.manage')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.update(tenantId, id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('team.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.usersService.remove(tenantId, id, user.userId);
  }
}
