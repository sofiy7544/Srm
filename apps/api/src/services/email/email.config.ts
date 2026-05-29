import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Single source of truth for all email-related configuration.
 * Reads env once, validates, and exposes typed accessors.
 */
@Injectable()
export class EmailConfig {
  private readonly logger = new Logger(EmailConfig.name);

  readonly resendApiKey: string;
  readonly from: string;
  readonly fromName: string;
  readonly replyTo?: string;
  readonly appUrl: string;
  readonly appName: string;
  readonly supportEmail: string;
  readonly brandColor: string;
  readonly accentColor: string;
  readonly sync: boolean;
  readonly enabled: boolean;

  // Retry / timeout
  readonly sendTimeoutMs = 10_000;
  readonly maxAttempts = 5;
  readonly backoffMs = 2_000; // exponential base

  // Token TTLs
  readonly verifyTokenTtlHours = 24;
  readonly resetTokenTtlMinutes = 30;
  readonly inviteTokenTtlDays = 7;

  constructor(config: ConfigService) {
    this.resendApiKey = config.get<string>('RESEND_API_KEY', '').trim();
    this.from = config.get<string>('EMAIL_FROM', 'onboarding@resend.dev').trim();
    this.fromName = config.get<string>('EMAIL_FROM_NAME', 'MaybSrm').trim();
    const replyTo = config.get<string>('EMAIL_REPLY_TO', '').trim();
    this.replyTo = replyTo.length > 0 ? replyTo : undefined;
    this.appUrl = (config.get<string>('APP_URL', 'http://localhost:3000') || '').replace(/\/$/, '');
    this.appName = config.get<string>('APP_NAME', 'MaybSrm').trim();
    this.supportEmail = config.get<string>('EMAIL_SUPPORT', 'support@realtorcrm.app').trim();
    this.brandColor = config.get<string>('EMAIL_BRAND_COLOR', '#0A0A0A').trim();
    this.accentColor = config.get<string>('EMAIL_ACCENT_COLOR', '#0066FF').trim();
    this.sync = config.get<string>('EMAIL_SYNC', 'false') === 'true';

    this.enabled = this.resendApiKey.length > 0;
    if (!this.enabled) {
      this.logger.warn(
        'RESEND_API_KEY not set — email sending disabled (running in no-op mode).',
      );
    }

    if (
      config.get<string>('NODE_ENV') === 'production' &&
      this.enabled &&
      this.from === 'onboarding@resend.dev'
    ) {
      this.logger.warn(
        'EMAIL_FROM is still set to the Resend sandbox sender (onboarding@resend.dev). ' +
          'Configure a verified domain sender for production.',
      );
    }
  }

  /** RFC 5322 `Display Name <addr@x.com>` format. */
  get fromFormatted(): string {
    return this.fromName ? `${this.fromName} <${this.from}>` : this.from;
  }
}
