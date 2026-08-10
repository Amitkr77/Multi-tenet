import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  adjustInventorySchema,
  setLowStockThresholdSchema,
  transferInventorySchema,
} from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermissions('inventory.view')
  list(
    @CurrentTenantId() tenantId: string,
    @Query('lowStock') lowStock?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.inventoryService.list(tenantId, {
      lowStock: lowStock === 'true',
      warehouseId,
    });
  }

  @ZodBody(adjustInventorySchema)
  @Patch(':variantId')
  @RequirePermissions('inventory.adjust')
  adjust(
    @CurrentTenantId() tenantId: string,
    @Param('variantId') variantId: string,
    @Body(new ZodValidationPipe(adjustInventorySchema)) dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.adjust(tenantId, variantId, dto, user.userId);
  }

  @ZodBody(setLowStockThresholdSchema)
  @Patch(':variantId/threshold')
  @RequirePermissions('inventory.manage_alerts')
  setThreshold(
    @CurrentTenantId() tenantId: string,
    @Param('variantId') variantId: string,
    @Body(new ZodValidationPipe(setLowStockThresholdSchema)) dto: any,
  ) {
    return this.inventoryService.setLowStockThreshold(tenantId, variantId, dto);
  }

  @Post('transfer')
  @RequirePermissions('inventory.adjust')
  transfer(
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(transferInventorySchema)) dto: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.transfer(tenantId, dto, user.userId);
  }

  @Get(':variantId/history')
  @RequirePermissions('inventory.view')
  history(
    @CurrentTenantId() tenantId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.inventoryService.history(tenantId, variantId);
  }
}
