import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { TenantStatusEnum, UserStatusEnum } from '@prisma/client';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { authConfig } from '../config/auth.config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { extractBearerToken } from './auth-session.util';
import { JwtPayload } from './decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(authConfig.KEY)
    authSettings: ConfigType<typeof authConfig>,
    private redis: RedisService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: authSettings.jwtSecret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: Record<string, unknown>): Promise<JwtPayload> {
    // 检查 Token 是否已被加入黑名单（logout）
    const token = extractBearerToken(req.headers.authorization);
    if (token && await this.redis.isBlacklisted(token)) {
      throw new UnauthorizedException('Token 已失效，请重新登录');
    }

    const userId = payload.sub;
    if (typeof userId !== 'string') {
      throw new UnauthorizedException('Token 无效，请重新登录');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
      },
    });

    if (!user || user.deletedAt || user.status !== UserStatusEnum.ACTIVE) {
      throw new UnauthorizedException('账号不可用');
    }

    if (user.tenantId && (!user.tenant || user.tenant.deletedAt || user.tenant.status !== TenantStatusEnum.ACTIVE)) {
      throw new UnauthorizedException('租户不可用');
    }

    return {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      side: user.tenantId ? 'tenant' : 'platform',
    };
  }
}
