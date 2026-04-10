import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRoleEnum } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto } from './dto/login.dto';
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL } from './auth-session.util';
import { JwtPayload } from './decorators/current-user.decorator';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const ACTIVE_RECORD_STATUS = 1;
const INVALID_CREDENTIALS_MESSAGE = '用户名或密码错误';
const ACCOUNT_UNAVAILABLE_MESSAGE = '账号不可用';
const TENANT_UNAVAILABLE_MESSAGE = '租户不可用';
const ACCOUNT_CONFLICT_MESSAGE = '账号存在冲突，请联系管理员处理';

type AuthUserRecord = Prisma.UserGetPayload<{
  include: {
    tenant: true;
  };
}>;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redis: RedisService,
  ) {}

  async login(loginDto: LoginDto) {
    const { account, password } = loginDto;
    const user = await this.findLoginUser(account, password);
    const accessToken = this.jwtService.sign(this.buildAccessTokenPayload(user));

    // 生成 Refresh Token（随机字符串），存入 Redis
    const refreshToken = crypto.randomBytes(48).toString('hex');
    await this.redis.setRefreshToken(refreshToken, user.id, REFRESH_TOKEN_TTL);

    return {
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL,
      refreshToken,
      user: this.toUserProfile(user),
    };
  }

  async refresh(refreshToken: string) {
    const userId = await this.redis.getRefreshTokenUser(refreshToken);
    if (!userId) {
      throw new UnauthorizedException('Refresh Token 已失效，请重新登录');
    }

    const user = await this.getAvailableUserById(userId);
    const accessToken = this.jwtService.sign(this.buildAccessTokenPayload(user));

    // Refresh Token Rotation: invalidate old token, issue new one
    await this.redis.deleteRefreshToken(refreshToken);
    const newRefreshToken = crypto.randomBytes(48).toString('hex');
    await this.redis.setRefreshToken(newRefreshToken, user.id, REFRESH_TOKEN_TTL);

    return {
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL,
      refreshToken: newRefreshToken,
    };
  }

  async getProfile(userId: string) {
    const user = await this.getAvailableUserById(userId);
    return this.toUserProfile(user);
  }

  async logout(accessToken: string | null, refreshToken?: string) {
    // Access Token 加入黑名单（剩余有效期内）
    if (accessToken) {
      try {
        const decoded = this.jwtService.verify(accessToken) as { exp: number };
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.redis.addToBlacklist(accessToken, ttl);
        }
      } catch {
        // token 已过期，无需加黑名单
      }
    }

    // 删除 Refresh Token
    if (refreshToken) {
      await this.redis.deleteRefreshToken(refreshToken);
    }
  }

  private async findLoginUser(account: string, password: string): Promise<AuthUserRecord> {
    const users = await this.prisma.user.findMany({
      where: {
        username: account,
        deletedAt: null,
      },
      include: {
        tenant: true,
      },
    });

    if (users.length === 0) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatchedUsers: AuthUserRecord[] = [];
    for (const user of users) {
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (isMatch) {
        passwordMatchedUsers.push(user);
      }
    }

    if (passwordMatchedUsers.length === 0) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const availableUsers: AuthUserRecord[] = [];
    let unavailableError: UnauthorizedException | null = null;

    for (const user of passwordMatchedUsers) {
      try {
        this.assertUserAvailable(user);
        availableUsers.push(user);
      } catch (error) {
        if (error instanceof UnauthorizedException) {
          unavailableError = error;
          continue;
        }
        throw error;
      }
    }

    if (availableUsers.length === 1) {
      return availableUsers[0];
    }

    if (availableUsers.length > 1) {
      throw new UnauthorizedException(ACCOUNT_CONFLICT_MESSAGE);
    }

    throw unavailableError ?? new UnauthorizedException(ACCOUNT_UNAVAILABLE_MESSAGE);
  }

  private async getAvailableUserById(userId: string): Promise<AuthUserRecord> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
      },
    });

    this.assertUserAvailable(user);
    return user;
  }

  private assertUserAvailable(user: AuthUserRecord | null): asserts user is AuthUserRecord {
    if (!user || user.deletedAt || user.status !== ACTIVE_RECORD_STATUS) {
      throw new UnauthorizedException(ACCOUNT_UNAVAILABLE_MESSAGE);
    }

    if (user.tenantId && (!user.tenant || user.tenant.deletedAt || user.tenant.status !== ACTIVE_RECORD_STATUS)) {
      throw new UnauthorizedException(TENANT_UNAVAILABLE_MESSAGE);
    }
  }

  private buildAccessTokenPayload(user: AuthUserRecord): Omit<JwtPayload, 'userId'> & { sub: string } {
    return {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role as UserRoleEnum,
      side: user.tenantId ? 'tenant' : 'platform',
    };
  }

  private toUserProfile(user: AuthUserRecord) {
    return {
      id: user.id,
      account: user.username,
      realName: user.realName,
      role: user.role as UserRoleEnum,
      tenantId: user.tenantId,
    };
  }
}
