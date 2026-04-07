import { Controller, Post, Get, Body, Req, Res, HttpCode, HttpStatus, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from './decorators/current-user.decorator';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import {
  clearRefreshTokenCookie,
  extractBearerToken,
  getRefreshTokenFromCookie,
  setRefreshTokenCookie,
} from './auth-session.util';

@ApiTags('Auth - 鉴权中心')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户身份登录 (Login)', description: 'OS运营端人员或租户员工登录系统，获取访问 Token。前台通过判断 tenantId 进行区分。' })
  @ApiResponse({ status: 200, description: '登录成功，返回 accessToken 与用户信息' })
  @ApiResponse({ status: 401, description: '账号或密码错误' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.login(loginDto);

    setRefreshTokenCookie(res, req, session.refreshToken);

    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      user: session.user,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新令牌 (Refresh Token)', description: '当 accessToken 过期时，使用长效 refreshToken 换取新的凭证' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = getRefreshTokenFromCookie(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh Token 已失效，请重新登录');
    }

    const session = await this.authService.refresh(refreshToken);
    setRefreshTokenCookie(res, req, session.refreshToken);

    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
    };
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
  @ApiOperation({ summary: '注销退出 (Logout)', description: '吊销当前会话的 refresh cookie；若请求中携带 accessToken，则一并加入黑名单' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const accessToken = extractBearerToken(req.headers.authorization);
    const refreshToken = getRefreshTokenFromCookie(req) ?? undefined;
    await this.authService.logout(accessToken, refreshToken);
    clearRefreshTokenCookie(res, req);
    return null;
  }
}
