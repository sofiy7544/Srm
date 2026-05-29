import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, Locale } from '@prisma/client';
import { EmailService } from '../../services/email/email.service';
import { EmailTokenService } from '../../services/email/email-token.service';
import { EmailConfig } from '../../services/email/email.config';
import { AuditService } from '../audit/audit.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface LoginContext {
  ip?: string;
  userAgent?: string;
}

/**
 * AuthService — owns credential and refresh-token logic, and orchestrates
 * email-flow side effects (verification, welcome, password reset, login alert).
 *
 * Email sends are fire-and-forget by design: they go through the BullMQ queue
 * (see EmailService) and are never allowed to block or fail the auth flow.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly tokens: EmailTokenService,
    private readonly emailConfig: EmailConfig,
    private readonly audit: AuditService,
  ) {
    const refreshSecret = config.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) throw new Error('JWT_REFRESH_SECRET is required');
    if (
      config.get<string>('NODE_ENV') === 'production' &&
      (refreshSecret === 'dev_refresh' || refreshSecret === 'change_me_refresh_secret')
    ) {
      throw new Error('JWT_REFRESH_SECRET must be set to a strong random value in production');
    }
  }

  async register(input: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    role?: UserRole;
    locale?: Locale;
  }) {
    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) {
      throw new UnauthorizedException('Email already registered');
    }
    const passwordHash = await argon2.hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        phone: input.phone,
        role: input.role ?? UserRole.REALTOR,
        locale: input.locale ?? Locale.ru,
      },
    });

    // Fire-and-forget — must never block or fail the response.
    void this.sendVerificationEmail(user.id, user.email, user.fullName);
    void this.sendWelcomeEmail(user.email, user.fullName);

    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(email: string, password: string, ctx: LoginContext = {}) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const previousLoginAt = user.lastLoginAt;
    await this.prisma.user
      .update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), lastLoginIp: ctx.ip ?? null },
      })
      .catch((e) => this.logger.warn(`lastLogin update failed: ${(e as Error).message}`));

    // Audit: записываем факт входа (best-effort).
    void this.audit.update(user.id, 'User', user.id, {
      event: 'login',
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      firstLogin: !previousLoginAt,
    });

    // First-time sign-in is covered by the welcome email; only alert on subsequent logins.
    if (previousLoginAt) {
      void this.sendLoginAlertEmail(user.email, user.fullName, ctx);
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    await this.prisma.refreshToken
      .updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const REFRESH_GRACE_MS = 5_000;

    const result = await this.prisma.$transaction(async (tx) => {
      const record = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!record || record.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      if (record.revokedAt) {
        if (Date.now() - record.revokedAt.getTime() > REFRESH_GRACE_MS) {
          throw new UnauthorizedException('Invalid refresh token');
        }
      } else {
        await tx.refreshToken.update({
          where: { id: record.id },
          data: { revokedAt: new Date() },
        });
      }
      return record;
    });

    return this.issueTokens(result.user.id, result.user.email, result.user.role);
  }

  // ============ Email verification ============

  async verifyEmail(token: string): Promise<{ ok: true }> {
    const tokenHash = this.tokens.hash(token);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: record.userId, usedAt: null, id: { not: record.id } },
        data: { usedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  async resendVerification(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return ok to avoid leaking which addresses are registered.
    if (user && !user.emailVerifiedAt) {
      void this.sendVerificationEmail(user.id, user.email, user.fullName);
    }
    return { ok: true };
  }

  // ============ Forgot / reset password ============

  async forgotPassword(email: string, ctx: LoginContext = {}): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.isActive) {
      const plain = this.tokens.generate();
      const tokenHash = this.tokens.hash(plain);
      const expiresAt = new Date(
        Date.now() + this.emailConfig.resetTokenTtlMinutes * 60 * 1000,
      );

      await this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          requestIp: ctx.ip ?? null,
        },
      });

      const resetUrl = `${this.emailConfig.appUrl}/auth/reset-password?token=${encodeURIComponent(plain)}`;
      void this.email.sendTemplate({
        to: user.email,
        template: 'reset-password',
        variables: {
          fullName: user.fullName,
          resetUrl,
          expiresInMinutes: this.emailConfig.resetTokenTtlMinutes,
          requestIp: ctx.ip,
        },
        metadata: { userId: user.id },
      });
    }
    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ ok: true }> {
    const tokenHash = this.tokens.hash(token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null, id: { not: record.id } },
        data: { usedAt: new Date() },
      }),
      // Force re-login everywhere after a password change.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  // ============ Internal email helpers ============

  private async sendVerificationEmail(
    userId: string,
    email: string,
    fullName: string,
  ): Promise<void> {
    try {
      const plain = this.tokens.generate();
      const tokenHash = this.tokens.hash(plain);
      const expiresAt = new Date(
        Date.now() + this.emailConfig.verifyTokenTtlHours * 60 * 60 * 1000,
      );
      await this.prisma.emailVerificationToken.create({
        data: { userId, tokenHash, expiresAt },
      });

      const verifyUrl = `${this.emailConfig.appUrl}/auth/verify-email?token=${encodeURIComponent(plain)}`;
      await this.email.sendTemplate({
        to: email,
        template: 'verify-email',
        variables: {
          fullName,
          verifyUrl,
          expiresInHours: this.emailConfig.verifyTokenTtlHours,
        },
        metadata: { userId },
      });
    } catch (e) {
      this.logger.error(`sendVerificationEmail failed: ${(e as Error).message}`);
    }
  }

  private async sendWelcomeEmail(email: string, fullName: string): Promise<void> {
    try {
      await this.email.sendTemplate({
        to: email,
        template: 'welcome',
        variables: {
          fullName,
          ctaUrl: `${this.emailConfig.appUrl}/dashboard`,
        },
      });
    } catch (e) {
      this.logger.error(`sendWelcomeEmail failed: ${(e as Error).message}`);
    }
  }

  private async sendLoginAlertEmail(
    email: string,
    fullName: string,
    ctx: LoginContext,
  ): Promise<void> {
    try {
      const loginAt = new Date().toUTCString();
      await this.email.sendTemplate({
        to: email,
        template: 'login-alert',
        variables: {
          fullName,
          loginAt,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          secureUrl: `${this.emailConfig.appUrl}/settings/security`,
        },
      });
    } catch (e) {
      this.logger.error(`sendLoginAlertEmail failed: ${(e as Error).message}`);
    }
  }

  private async issueTokens(userId: string, email: string, role: UserRole) {
    const payload: JwtPayload = { sub: userId, email, role };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(48).toString('base64url');
    const tokenHash = this.hashRefreshToken(refreshToken);
    const ttlDays = this.parseDays(this.config.get<string>('JWT_REFRESH_TTL', '30d'));
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken, user: { id: userId, email, role } };
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDays(ttl: string): number {
    const match = ttl.match(/^(\d+)d$/);
    return match ? parseInt(match[1], 10) : 30;
  }
}
