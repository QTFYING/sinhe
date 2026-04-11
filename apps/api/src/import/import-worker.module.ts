import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ImportModule } from './import.module';

@Module({
  imports: [PrismaModule, RedisModule, ImportModule],
})
export class ImportWorkerModule {}
