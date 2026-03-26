import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async login(loginDto: LoginDto) {
    const { username, password, tenantId } = loginDto;
    
    const user = await this.prisma.user.findFirst({
      where: Object.assign(
        { username, status: 1 },
        // 如果未传 tenantId（如总代端直接登录），则根据用户名找；传了则严格限制
        tenantId !== undefined ? { tenantId } : {}
      )
    });

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误 (User not found)');
    }

    // 强制使用工业级 Bcrypt 散列比对底层密文数据
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('高危：口令非法！用户名或密码错误');
    }

    const payload = { 
      sub: user.id, 
      tenantId: user.tenantId, 
      role: user.role 
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId
      }
    };
  }
}
