import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsPdfService } from './analytics-pdf.service';

@Module({
  imports: [InventoryModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsPdfService],
})
export class AnalyticsModule {}
