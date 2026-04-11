import { Module } from '@nestjs/common';
import { EnvironmentModule } from './config/environment.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { SettingsModule } from './settings/settings.module';
import { OrderModule } from './order/order.module';
import { ImportModule } from './import/import.module';
import { PaymentModule } from './payment/payment.module';
import { ReportModule } from './report/report.module';
import { NotificationModule } from './notification/notification.module';
import { FinanceModule } from './finance/finance.module';

@Module({
  imports: [
    EnvironmentModule,
    PrismaModule, 
    RedisModule, 
    AuthModule, 
    TenantModule, 
    SettingsModule,
    OrderModule, 
    ImportModule.register('api'), 
    PaymentModule,
    FinanceModule,
    ReportModule,
    NotificationModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
