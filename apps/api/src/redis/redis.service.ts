import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import * as crypto from 'crypto';
import { redisConfig } from '../config/redis.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(redisConfig.KEY)
    redisSettings: ConfigType<typeof redisConfig>,
  ) {
    this.client = createClient({
      url: redisSettings.url,
    });
  }

  async onModuleInit() {
    this.client.on('error', (err) => {
      this.logger.error('Redis connection error', err);
    });
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * Acquire a distributed lock. Returns a unique lock value on success (used to release), or null on failure.
   */
  async acquireLock(key: string, ttlSeconds: number = 30): Promise<string | null> {
    const lockValue = crypto.randomUUID();
    const result = await this.client.set(key, lockValue, {
      NX: true,
      EX: ttlSeconds,
    });
    return result === 'OK' ? lockValue : null;
  }

  /**
   * Release the lock only if the caller still owns it (atomic check-and-delete via Lua script).
   */
  async releaseLock(key: string, lockValue: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.client.eval(script, { keys: [key], arguments: [lockValue] });
    return result === 1;
  }

  /**
   * Add a JWT token to the blacklist (for logout)
   */
  async addToBlacklist(token: string, ttlSeconds: number): Promise<void> {
    await this.client.set(`bl:${token}`, '1', { EX: ttlSeconds });
  }

  /**
   * Check if a JWT token is blacklisted
   */
  async isBlacklisted(token: string): Promise<boolean> {
    const result = await this.client.get(`bl:${token}`);
    return result !== null;
  }

  /**
   * Store refresh token → userId mapping
   */
  async setRefreshToken(refreshToken: string, userId: string, ttlSeconds: number): Promise<void> {
    await this.client.set(this.getRefreshTokenKey(refreshToken), userId, { EX: ttlSeconds });
  }

  /**
   * Get userId from refresh token
   */
  async getRefreshTokenUser(refreshToken: string): Promise<string | null> {
    return this.client.get(this.getRefreshTokenKey(refreshToken));
  }

  /**
   * Delete refresh token (logout)
   */
  async deleteRefreshToken(refreshToken: string): Promise<void> {
    await this.client.del(this.getRefreshTokenKey(refreshToken));
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  }

  async getJson<T>(key: string): Promise<T | null> {
    const result = await this.client.get(key);
    if (!result) {
      return null;
    }

    return JSON.parse(result) as T;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  private getRefreshTokenKey(refreshToken: string): string {
    const digest = crypto.createHash('sha256').update(refreshToken).digest('hex');
    return `rt:${digest}`;
  }
}
