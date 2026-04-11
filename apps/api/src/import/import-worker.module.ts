import { Module } from '@nestjs/common';
import { EnvironmentModule } from '../config/environment.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ImportModule } from './import.module';

@Module({
  imports: [EnvironmentModule, PrismaModule, RedisModule, ImportModule.register('worker')],
})
export class ImportWorkerModule {}
