import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { UserRoleEnum } from '@prisma/client';
import { createClient, RedisClientType } from 'redis';
import * as crypto from 'crypto';
import { redisConfig } from '../config/redis.config';

type SessionStatus = 'active' | 'revoked';

export interface AuthSessionRecord {
  sessionId: string;
  userId: string;
  account: string;
  role: UserRoleEnum;
  tenantId: string | null;
  status: SessionStatus;
  refreshTokenHash: string;
  createdAt: number;
  lastSeenAt: number;
  accessExpiresAt: number;
  refreshExpiresAt: number;
}

export interface AuthSessionSnapshot {
  sessionId: string;
  userId: string;
  account: string;
  role: UserRoleEnum;
  tenantId: string | null;
}

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

  async getUserTokenVersion(userId: string): Promise<number> {
    const key = this.getUserTokenVersionKey(userId);
    const current = await this.client.get(key);
    if (current) {
      const parsed = Number.parseInt(current, 10);
      return Number.isNaN(parsed) ? 1 : parsed;
    }

    await this.client.set(key, '1');
    return 1;
  }

  async createAuthSession(
    snapshot: AuthSessionSnapshot,
    refreshToken: string,
    accessTtlSeconds: number,
    refreshTtlSeconds: number,
  ): Promise<AuthSessionRecord> {
    const now = Date.now();
    const refreshTokenHash = this.hashToken(refreshToken);
    const session: AuthSessionRecord = {
      ...snapshot,
      status: 'active',
      refreshTokenHash,
      createdAt: now,
      lastSeenAt: now,
      accessExpiresAt: now + accessTtlSeconds * 1000,
      refreshExpiresAt: now + refreshTtlSeconds * 1000,
    };

    const sessionKey = this.getSessionKey(session.sessionId);
    const userSessionsKey = this.getUserSessionsKey(session.userId);
    const refreshKey = this.getRefreshTokenKeyByHash(refreshTokenHash);

    await this.client.multi()
      .hSet(sessionKey, this.serializeSession(session))
      .expire(sessionKey, refreshTtlSeconds)
      .set(refreshKey, session.sessionId, { EX: refreshTtlSeconds })
      .zAdd(userSessionsKey, { score: session.lastSeenAt, value: session.sessionId })
      .exec();

    return session;
  }

  async getAuthSession(sessionId: string): Promise<AuthSessionRecord | null> {
    const result = await this.client.hGetAll(this.getSessionKey(sessionId));
    if (Object.keys(result).length === 0) {
      return null;
    }

    return this.deserializeSession(result);
  }

  async getAuthSessionByRefreshToken(refreshToken: string): Promise<AuthSessionRecord | null> {
    const refreshTokenHash = this.hashToken(refreshToken);
    const sessionId = await this.client.get(this.getRefreshTokenKeyByHash(refreshTokenHash));
    if (!sessionId) {
      return null;
    }

    const session = await this.getAuthSession(sessionId);
    if (!session || session.refreshTokenHash !== refreshTokenHash) {
      return null;
    }

    return session;
  }

  async refreshAuthSession(
    sessionId: string,
    snapshot: Omit<AuthSessionSnapshot, 'sessionId'>,
    nextRefreshToken: string,
    accessTtlSeconds: number,
    refreshTtlSeconds: number,
  ): Promise<AuthSessionRecord | null> {
    const existing = await this.getAuthSession(sessionId);
    if (!existing) {
      return null;
    }

    const now = Date.now();
    const nextRefreshTokenHash = this.hashToken(nextRefreshToken);
    const nextSession: AuthSessionRecord = {
      ...existing,
      ...snapshot,
      status: 'active',
      refreshTokenHash: nextRefreshTokenHash,
      lastSeenAt: now,
      accessExpiresAt: now + accessTtlSeconds * 1000,
      refreshExpiresAt: now + refreshTtlSeconds * 1000,
    };

    const sessionKey = this.getSessionKey(sessionId);
    const userSessionsKey = this.getUserSessionsKey(existing.userId);
    const oldRefreshKey = this.getRefreshTokenKeyByHash(existing.refreshTokenHash);
    const nextRefreshKey = this.getRefreshTokenKeyByHash(nextRefreshTokenHash);

    await this.client.multi()
      .del(oldRefreshKey)
      .hSet(sessionKey, this.serializeSession(nextSession))
      .expire(sessionKey, refreshTtlSeconds)
      .set(nextRefreshKey, sessionId, { EX: refreshTtlSeconds })
      .zAdd(userSessionsKey, { score: nextSession.lastSeenAt, value: sessionId })
      .exec();

    return nextSession;
  }

  async touchAuthSession(sessionId: string, userId: string): Promise<void> {
    const now = Date.now();
    await this.client.multi()
      .hSet(this.getSessionKey(sessionId), { lastSeenAt: String(now) })
      .zAdd(this.getUserSessionsKey(userId), { score: now, value: sessionId })
      .exec();
  }

  async revokeAuthSession(sessionId: string): Promise<void> {
    const session = await this.getAuthSession(sessionId);
    if (!session) {
      return;
    }

    await this.client.multi()
      .del(this.getSessionKey(sessionId))
      .del(this.getRefreshTokenKeyByHash(session.refreshTokenHash))
      .zRem(this.getUserSessionsKey(session.userId), sessionId)
      .exec();
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

  private serializeSession(session: AuthSessionRecord): Record<string, string> {
    return {
      sessionId: session.sessionId,
      userId: session.userId,
      account: session.account,
      role: session.role,
      tenantId: session.tenantId ?? '',
      status: session.status,
      refreshTokenHash: session.refreshTokenHash,
      createdAt: String(session.createdAt),
      lastSeenAt: String(session.lastSeenAt),
      accessExpiresAt: String(session.accessExpiresAt),
      refreshExpiresAt: String(session.refreshExpiresAt),
    };
  }

  private deserializeSession(raw: Record<string, string>): AuthSessionRecord {
    return {
      sessionId: raw.sessionId,
      userId: raw.userId,
      account: raw.account,
      role: raw.role as UserRoleEnum,
      tenantId: raw.tenantId || null,
      status: raw.status as SessionStatus,
      refreshTokenHash: raw.refreshTokenHash,
      createdAt: Number.parseInt(raw.createdAt, 10),
      lastSeenAt: Number.parseInt(raw.lastSeenAt, 10),
      accessExpiresAt: Number.parseInt(raw.accessExpiresAt, 10),
      refreshExpiresAt: Number.parseInt(raw.refreshExpiresAt, 10),
    };
  }

  private getSessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `user:sessions:${userId}`;
  }

  private getUserTokenVersionKey(userId: string): string {
    return `user:tokenVersion:${userId}`;
  }

  private getRefreshTokenKeyByHash(refreshTokenHash: string): string {
    return `refresh:${refreshTokenHash}`;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

}
