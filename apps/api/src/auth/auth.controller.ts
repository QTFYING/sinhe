import { Controller, Post, Get, Body, Req, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from './decorators/current-user.decorator';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';

@ApiTags('Auth - 鉴权中心')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户身份登录 (Login)', description: 'OS运营端人员或租户员工登录系统，获取访问 Token。前台通过判断 tenantId 进行区分。' })
  @ApiResponse({ status: 200, description: '登录成功，返回 accessToken 与用户信息' })
  @ApiResponse({ status: 401, description: '账号或密码错误' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新令牌 (Refresh Token)', description: '当 accessToken 过期时，使用长效 refreshToken 换取新的凭证' })
  @ApiBody({ schema: { type: 'object', properties: { refreshToken: { type: 'string', description: '用于续期的原长效Token' } }, required: ['refreshToken'] } })
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息 (Me)', description: '返回当前已登录用户的基本信息，用于前端初始化用户状态' })
  @ApiResponse({ status: 200, description: '返回用户信息' })
  async me(@CurrentUser() currentUser: JwtPayload) {
    return this.authService.getProfile(currentUser.userId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '注销退出 (Logout)', description: '吊销当前用户的 Token 凭证，需携带有效 Access Token 访问' })
  async logout(@Req() req: Request) {
    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.replace('Bearer ', '');
    const refreshToken = req.body?.refreshToken;
    await this.authService.logout(accessToken, refreshToken);
    return null;
  }
}
