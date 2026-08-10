import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';

@Module({
  controllers: [InventoryController, WarehousesController],
  providers: [InventoryService, WarehousesService],
  // Exported so AnalyticsModule can reuse the existing low-stock JS-filter
  // logic (see that service's own comment) rather than re-deriving it.
  exports: [InventoryService],
})
export class InventoryModule {}
