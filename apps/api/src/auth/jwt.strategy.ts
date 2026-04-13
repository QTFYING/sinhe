import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { TenantStatusEnum, UserStatusEnum } from '@prisma/client';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { authConfig } from '../config/auth.config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
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
    const userId = payload.sub;
    const sessionId = payload.sid;
    const tokenVersion = payload.ver;
    if (typeof userId !== 'string' || typeof sessionId !== 'string' || typeof tokenVersion !== 'number') {
      throw new UnauthorizedException('Token 无效，请重新登录');
    }

    const session = await this.redis.getAuthSession(sessionId);
    if (!session || session.status !== 'active' || session.userId !== userId) {
      throw new UnauthorizedException('会话已失效，请重新登录');
    }

    const currentTokenVersion = await this.redis.getUserTokenVersion(userId);
    if (tokenVersion !== currentTokenVersion) {
      throw new UnauthorizedException('会话已失效，请重新登录');
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

    await this.redis.touchAuthSession(sessionId, user.id);

    return {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      side: user.tenantId ? 'tenant' : 'platform',
      sessionId,
      tokenVersion,
    };
  }
}
