import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { RolesController, PermissionsController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [AuditLogModule],
  controllers: [RolesController, PermissionsController],
  providers: [RolesService],
})
export class RolesModule {}
