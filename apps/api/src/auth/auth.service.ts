import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, TenantStatusEnum, UserRoleEnum, UserStatusEnum } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto } from './dto/login.dto';
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL } from './auth-session.util';
import { JwtPayload } from './decorators/current-user.decorator';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

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
    const tokenVersion = await this.redis.getUserTokenVersion(user.id);
    const sessionId = crypto.randomUUID();
    const refreshToken = crypto.randomBytes(48).toString('hex');
    await this.redis.createAuthSession(
      {
        sessionId,
        userId: user.id,
        account: user.account,
        role: user.role as UserRoleEnum,
        tenantId: user.tenantId,
      },
      refreshToken,
      ACCESS_TOKEN_TTL,
      REFRESH_TOKEN_TTL,
    );
    const accessToken = this.jwtService.sign(this.buildAccessTokenPayload(user, sessionId, tokenVersion));

    return {
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL,
      refreshToken,
      user: this.toUserProfile(user),
    };
  }

  async refresh(refreshToken: string) {
    const session = await this.redis.getAuthSessionByRefreshToken(refreshToken);
    if (!session || session.status !== 'active') {
      throw new UnauthorizedException('Refresh Token 已失效，请重新登录');
    }

    const user = await this.getAvailableUserById(session.userId);
    const tokenVersion = await this.redis.getUserTokenVersion(user.id);
    const newRefreshToken = crypto.randomBytes(48).toString('hex');
    const nextSession = await this.redis.refreshAuthSession(
      session.sessionId,
      {
        userId: user.id,
        account: user.account,
        role: user.role as UserRoleEnum,
        tenantId: user.tenantId,
      },
      newRefreshToken,
      ACCESS_TOKEN_TTL,
      REFRESH_TOKEN_TTL,
    );
    if (!nextSession) {
      throw new UnauthorizedException('Refresh Token 已失效，请重新登录');
    }

    const accessToken = this.jwtService.sign(
      this.buildAccessTokenPayload(user, nextSession.sessionId, tokenVersion),
    );

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
    if (refreshToken) {
      const session = await this.redis.getAuthSessionByRefreshToken(refreshToken);
      if (session) {
        await this.redis.revokeAuthSession(session.sessionId);
      }
    }

    if (accessToken) {
      const payload = this.jwtService.decode(accessToken);
      if (payload && typeof payload === 'object' && typeof payload.sid === 'string') {
        await this.redis.revokeAuthSession(payload.sid);
      }
    }
  }

  private async findLoginUser(account: string, password: string): Promise<AuthUserRecord> {
    const users = await this.prisma.user.findMany({
      where: {
        account,
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
    if (!user || user.deletedAt || user.status !== UserStatusEnum.ACTIVE) {
      throw new UnauthorizedException(ACCOUNT_UNAVAILABLE_MESSAGE);
    }

    if (user.tenantId && (!user.tenant || user.tenant.deletedAt || user.tenant.status !== TenantStatusEnum.ACTIVE)) {
      throw new UnauthorizedException(TENANT_UNAVAILABLE_MESSAGE);
    }
  }

  private buildAccessTokenPayload(
    user: AuthUserRecord,
    sessionId: string,
    tokenVersion: number,
  ): Omit<JwtPayload, 'userId' | 'sessionId' | 'tokenVersion'> & {
    sub: string;
    sid: string;
    ver: number;
  } {
    return {
      sub: user.id,
      sid: sessionId,
      ver: tokenVersion,
      tenantId: user.tenantId,
      role: user.role as UserRoleEnum,
      side: user.tenantId ? 'tenant' : 'platform',
    };
  }

  private toUserProfile(user: AuthUserRecord) {
    return {
      id: user.id,
      account: user.account,
      realName: user.realName,
      role: user.role as UserRoleEnum,
      tenantId: user.tenantId,
    };
  }
}
