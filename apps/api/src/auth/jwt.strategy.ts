import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../redis/redis.service';
import { JwtPayload } from './decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private redis: RedisService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: Record<string, unknown>): Promise<JwtPayload> {
    // 检查 Token 是否已被加入黑名单（logout）
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (token && await this.redis.isBlacklisted(token)) {
      throw new UnauthorizedException('Token 已失效，请重新登录');
    }

    return {
      userId: payload.sub as string,
      tenantId: (payload.tenantId as string) || null,
      role: payload.role as string,
    };
  }
}
