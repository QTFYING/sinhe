import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../redis/redis.service';
import { JwtPayload } from './decorators/current-user.decorator';
import { extractBearerToken } from './auth-session.util';

const ACTIVE_RECORD_STATUS = 1;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private redis: RedisService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
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

    if (!user || user.deletedAt || user.status !== ACTIVE_RECORD_STATUS) {
      throw new UnauthorizedException('账号不可用');
    }

    if (user.tenantId && (!user.tenant || user.tenant.deletedAt || user.tenant.status !== ACTIVE_RECORD_STATUS)) {
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
