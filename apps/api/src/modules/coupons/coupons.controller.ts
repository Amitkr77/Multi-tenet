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
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
} from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { CouponsService } from './coupons.service';

/**
 * CRUD routes (staff, `coupons.manage`) and the public `/validate` preview
 * share one controller — unlike Products' `/storefront/products` split,
 * there's no *same-path* dual-mode conflict here (different paths), so the
 * guard-chain issue that forced that split doesn't apply.
 */
@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  @RequirePermissions('coupons.manage')
  list(@CurrentTenantId() tenantId: string) {
    return this.couponsService.list(tenantId);
  }

  @ZodBody(createCouponSchema)
  @Post()
  @RequirePermissions('coupons.manage')
  create(
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(createCouponSchema)) dto: any,
  ) {
    return this.couponsService.create(tenantId, dto);
  }

  @ZodBody(updateCouponSchema)
  @Patch(':id')
  @RequirePermissions('coupons.manage')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCouponSchema)) dto: any,
  ) {
    return this.couponsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('coupons.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    await this.couponsService.remove(tenantId, id);
  }

  @Public()
  @ZodBody(validateCouponSchema)
  @Post('validate')
  validate(
    @CurrentTenantId() tenantId: string | null,
    @Body(new ZodValidationPipe(validateCouponSchema)) dto: any,
  ) {
    if (!tenantId) {
      return { valid: false, reason: 'No store resolved for this request.' };
    }
    return this.couponsService.validatePreview(
      tenantId,
      dto.code,
      dto.subtotal,
    );
  }
}
