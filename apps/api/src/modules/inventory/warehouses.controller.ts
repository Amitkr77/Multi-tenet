import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createWarehouseSchema, updateWarehouseSchema } from '@saas/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { WarehousesService } from './warehouses.service';

@ApiTags('Inventory')
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @RequirePermissions('inventory.view')
  list(@CurrentTenantId() tenantId: string): Promise<any[]> {
    return this.warehousesService.list(tenantId);
  }

  @ZodBody(createWarehouseSchema)
  @Post()
  @RequirePermissions('inventory.manage_alerts')
  create(
    @CurrentTenantId() tenantId: string,
    @Body(new ZodValidationPipe(createWarehouseSchema)) dto: any,
  ) {
    return this.warehousesService.create(tenantId, dto);
  }

  @ZodBody(updateWarehouseSchema)
  @Patch(':id')
  @RequirePermissions('inventory.manage_alerts')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWarehouseSchema)) dto: any,
  ) {
    return this.warehousesService.update(tenantId, id, dto);
  }

  @Post(':id/set-default')
  @RequirePermissions('inventory.manage_alerts')
  @HttpCode(HttpStatus.OK)
  setDefault(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.warehousesService.setDefault(tenantId, id);
  }

  @Delete(':id')
  @RequirePermissions('inventory.manage_alerts')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    await this.warehousesService.remove(tenantId, id);
  }
}
