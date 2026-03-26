import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * Acquire a distributed lock to prevent payment concurrency or race conditions
   */
  async acquireLock(key: string, ttlSeconds: number = 30): Promise<boolean> {
    const result = await this.client.set(key, 'LOCKED', {
      NX: true,
      EX: ttlSeconds,
    });
    return result === 'OK';
  }

  /**
   * Release the lock
   */
  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }
}
