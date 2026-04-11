import { Module } from '@nestjs/common';
import { AdminUserController } from './admin-user.controller';
import { TenantAdminController } from './tenant-admin.controller';
import { TenantCertificationController } from './tenant-certification.controller';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';

@Module({
  controllers: [TenantController, TenantAdminController, AdminUserController, TenantCertificationController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
