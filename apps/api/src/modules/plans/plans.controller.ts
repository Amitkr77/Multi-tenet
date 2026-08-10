import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createPlanSchema, updatePlanSchema } from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PlansService } from './plans.service';

/**
 * One controller, method-level guards — same multi-tier pattern as Phase
 * 4's ReviewsController: `GET /plans` is genuinely public (pre-signup plan
 * picker, upgrade UI), the rest requires `platform.super_admin`. No
 * same-path guard conflict, so no split needed.
 */
@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Public()
  @Get()
  list() {
    return this.plansService.listPublic();
  }

  @ZodBody(createPlanSchema)
  @Post()
  @RequirePermissions('platform.super_admin')
  create(@Body(new ZodValidationPipe(createPlanSchema)) dto: any) {
    return this.plansService.create(dto);
  }

  @ZodBody(updatePlanSchema)
  @Patch(':id')
  @RequirePermissions('platform.super_admin')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePlanSchema)) dto: any,
  ) {
    return this.plansService.update(id, dto);
  }

  @Post(':id/archive')
  @RequirePermissions('platform.super_admin')
  archive(@Param('id') id: string) {
    return this.plansService.archive(id);
  }
}
