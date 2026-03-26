import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async login(loginDto: LoginDto) {
    const { username, password, tenantId } = loginDto;
    
    const user = await this.prisma.user.findFirst({
      where: {
        username,
        tenantId: tenantId || null, // null identifies an OS-level admin user
        status: 1
      }
    });

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误 (User not found)');
    }

    // Replace with proper hash comparison (e.g. bcrypt) in production
    if (user.passwordHash !== password) {
      throw new UnauthorizedException('用户名或密码错误 (Invalid password)');
    }

    const payload = { 
      sub: user.id, 
      tenantId: user.tenantId, 
      role: user.role 
    };

    return {
      // access_token: this.jwtService.sign(payload),
      access_token: 'dummy-jwt-token-replace-with-jwtService',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId
      }
    };
  }
}
