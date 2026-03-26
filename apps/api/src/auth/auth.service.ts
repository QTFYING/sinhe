import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const ACCESS_TOKEN_TTL = 2 * 60 * 60; // 2 hours in seconds

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redis: RedisService,
  ) {}

  async login(loginDto: LoginDto) {
    const { username, password, tenantId } = loginDto;

    const whereClause: Record<string, unknown> = { username, status: 1 };
    if (tenantId !== undefined) {
      whereClause.tenantId = tenantId;
    }

    const user = await this.prisma.user.findFirst({ where: whereClause });
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // 生成 Refresh Token（随机字符串），存入 Redis
    const refreshToken = crypto.randomBytes(48).toString('hex');
    await this.redis.setRefreshToken(refreshToken, user.id, REFRESH_TOKEN_TTL);

    return {
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async refresh(refreshToken: string) {
    const userId = await this.redis.getRefreshTokenUser(refreshToken);
    if (!userId) {
      throw new UnauthorizedException('Refresh Token 已失效，请重新登录');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 1) {
      throw new UnauthorizedException('账号不可用');
    }

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

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

  async logout(accessToken: string, refreshToken?: string) {
    // Access Token 加入黑名单（剩余有效期内）
    try {
      const decoded = this.jwtService.verify(accessToken) as { exp: number };
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.redis.addToBlacklist(accessToken, ttl);
      }
    } catch {
      // token 已过期，无需加黑名单
    }

    // 删除 Refresh Token
    if (refreshToken) {
      await this.redis.deleteRefreshToken(refreshToken);
    }
  }
}
