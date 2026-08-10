import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@saas/shared-types';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { TenantsController } from './tenants.controller';
import { SuperAdminController } from './super-admin.controller';
import { TenantsService } from './tenants.service';

@Module({
  // BullModule.registerQueue needed for @InjectQueue(QUEUE_NAMES.dataExport)
  // in TenantsService — each module that injects a queue must register it
  // itself, same pattern OrdersModule/BillingModule/
  // WebhookSubscriptionsModule already established.
  imports: [
    AuditLogModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.dataExport }),
  ],
  // Order matters: TenantsController's literal `GET /tenants/me` must be
  // registered before SuperAdminController's `GET /tenants/:id` — Express
  // matches routes in registration order, and a param route registered
  // first would swallow `/tenants/me` as `:id = "me"`.
  controllers: [TenantsController, SuperAdminController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
