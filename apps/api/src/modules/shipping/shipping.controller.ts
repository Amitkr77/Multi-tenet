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
  createShippingZoneSchema,
  updateShippingZoneSchema,
  createShippingRateSchema,
  updateShippingRateSchema,
} from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { ShippingService } from './shipping.service';

@ApiTags('Shipping & Tax')
@Controller('shipping-zones')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get()
  @RequirePermissions('shipping.view')
  list(@CurrentTenantId() tenantId: string) {
    return this.shippingService.listZones(tenantId);
  }

  @ZodBody(createShippingZoneSchema)
  @Post()
  @RequirePermissions('shipping.manage')
  create(
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(createShippingZoneSchema)) dto: any,
  ) {
    return this.shippingService.createZone(tenantId, dto);
  }

  @ZodBody(updateShippingZoneSchema)
  @Patch(':id')
  @RequirePermissions('shipping.manage')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateShippingZoneSchema)) dto: any,
  ) {
    return this.shippingService.updateZone(tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('shipping.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    await this.shippingService.removeZone(tenantId, id);
  }

  @ZodBody(createShippingRateSchema)
  @Post(':id/rates')
  @RequirePermissions('shipping.manage')
  addRate(
    @CurrentTenantId() tenantId: string,
    @Param('id') zoneId: string,
    @Body(new ZodValidationPipe(createShippingRateSchema)) dto: any,
  ) {
    return this.shippingService.addRate(tenantId, zoneId, dto);
  }

  @ZodBody(updateShippingRateSchema)
  @Patch('rates/:rateId')
  @RequirePermissions('shipping.manage')
  updateRate(
    @CurrentTenantId() tenantId: string,
    @Param('rateId') rateId: string,
    @Body(new ZodValidationPipe(updateShippingRateSchema)) dto: any,
  ) {
    return this.shippingService.updateRate(tenantId, rateId, dto);
  }

  @Delete('rates/:rateId')
  @RequirePermissions('shipping.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRate(
    @CurrentTenantId() tenantId: string,
    @Param('rateId') rateId: string,
  ) {
    await this.shippingService.removeRate(tenantId, rateId);
  }
}
