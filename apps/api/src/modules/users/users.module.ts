import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@saas/shared-types';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    AuditLogModule,
    TenantsModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.email }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
