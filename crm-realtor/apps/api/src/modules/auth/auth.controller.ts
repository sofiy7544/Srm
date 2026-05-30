import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  type LoginInput,
  type RegisterInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type VerifyEmailInput,
  type ResendVerificationInput,
} from '@crm/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from './current-user.decorator';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.register(body);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return tokens;
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ auth: { limit: 20, ttl: 60_000 } })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.login(body.email, body.password, {
      ip: this.clientIp(req),
      userAgent: req.headers['user-agent']?.toString(),
    });
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return tokens;
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const fromCookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    const fromBody = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
    const token = fromCookie ?? fromBody;
    if (!token) {
      throw new UnauthorizedException('Refresh token missing');
    }
    const tokens = await this.auth.refresh(token);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return tokens;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token =
      (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE] ??
      (req.body as { refreshToken?: string } | undefined)?.refreshToken;
    if (token) await this.auth.logout(token);
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: CurrentUserPayload) {
    return user;
  }

  // ============ Email flows ============

  @Post('verify-email')
  @HttpCode(200)
  @Throttle({ auth: { limit: 20, ttl: 60_000 } })
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput,
  ) {
    return this.auth.verifyEmail(body.token);
  }

  @Post('resend-verification')
  @HttpCode(202)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  async resendVerification(
    @Body(new ZodValidationPipe(resendVerificationSchema)) body: ResendVerificationInput,
  ) {
    return this.auth.resendVerification(body.email);
  }

  @Post('forgot-password')
  @HttpCode(202)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput,
    @Req() req: Request,
  ) {
    return this.auth.forgotPassword(body.email, {
      ip: this.clientIp(req),
      userAgent: req.headers['user-agent']?.toString(),
    });
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
  ) {
    return this.auth.resetPassword(body.token, body.password);
  }

  // ============ Helpers ============

  private setAuthCookies(res: Response, access: string, refresh: string) {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    const base = {
      httpOnly: true,
      secure: isProd,
      // Фронт и API на разных доменах (*.up.railway.app, *.vercel.app) — это
      // cross-site. Чтобы куки авторизации отправлялись на API, в проде нужен
      // SameSite=None (только с Secure). Локально (http) — Lax.
      sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };
    res.cookie(ACCESS_COOKIE, access, { ...base, maxAge: 15 * 60 * 1000 });
    res.cookie(REFRESH_COOKIE, refresh, { ...base, maxAge: 30 * 24 * 60 * 60 * 1000 });
  }

  private clientIp(req: Request): string | undefined {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) {
      return fwd.split(',')[0]?.trim();
    }
    if (Array.isArray(fwd) && fwd.length > 0) {
      return fwd[0];
    }
    return req.ip ?? req.socket?.remoteAddress ?? undefined;
  }
}
