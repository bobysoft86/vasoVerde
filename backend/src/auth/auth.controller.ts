import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/types/auth-request';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}
  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      path: '/api/v1/auth',
      maxAge: 7 * 86400000,
    };
  }
  private setRefresh(res: Response, token: string) {
    res.cookie('refresh_token', token, this.cookieOptions());
  }
  private refreshCookie(req: AuthenticatedRequest) {
    return (req.cookies as { refresh_token?: string } | undefined)
      ?.refresh_token;
  }
  @Post('login')
  @ApiOperation({ summary: 'Inicia sesión' })
  @ApiBody({ type: LoginDto })
  async login(
    @Body() dto: LoginDto,
    @Headers('user-agent') ua: string,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, ua, req.ip);
    this.setRefresh(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }
  @Post('refresh') async refresh(
    @Req() req: AuthenticatedRequest,
    @Headers('user-agent') ua: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.refresh(this.refreshCookie(req), ua, req.ip);
    this.setRefresh(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }
  @Post('logout') async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(this.refreshCookie(req));
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    return { success: true };
  }
  @Post('logout-all') @UseGuards(JwtAuthGuard) @ApiBearerAuth() async logoutAll(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logoutAll(req.user.sub);
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    return { success: true };
  }
  @Get('me') @UseGuards(JwtAuthGuard) @ApiBearerAuth() me(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.auth.me(req.user.sub);
  }
  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth
      .changePassword(req.user.sub, dto)
      .then(() => ({ success: true }));
  }
}
