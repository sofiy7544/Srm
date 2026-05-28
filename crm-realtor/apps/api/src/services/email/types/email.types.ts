/**
 * Centralized type definitions for the email service.
 * Adding a new template:
 *   1. add its name to `EmailTemplateName`
 *   2. add its variables to `EmailTemplateVars`
 *   3. add a renderer entry in templates/index.ts
 */

export type EmailTemplateName =
  | 'welcome'
  | 'verify-email'
  | 'reset-password'
  | 'login-alert'
  | 'team-invitation';

export interface BaseTemplateVars {
  appName: string;
  appUrl: string;
  supportEmail: string;
  brandColor: string;
  accentColor: string;
  year: number;
}

export interface WelcomeVars {
  fullName: string;
  ctaUrl: string;
}

export interface VerifyEmailVars {
  fullName: string;
  verifyUrl: string;
  expiresInHours: number;
}

export interface ResetPasswordVars {
  fullName: string;
  resetUrl: string;
  expiresInMinutes: number;
  requestIp?: string;
}

export interface LoginAlertVars {
  fullName: string;
  loginAt: string; // formatted
  ip?: string;
  userAgent?: string;
  location?: string;
  secureUrl: string;
}

export interface TeamInvitationVars {
  inviterName: string;
  inviterEmail: string;
  inviteeEmail: string;
  role: string;
  acceptUrl: string;
  expiresInDays: number;
}

export type EmailTemplateVars = {
  welcome: WelcomeVars;
  'verify-email': VerifyEmailVars;
  'reset-password': ResetPasswordVars;
  'login-alert': LoginAlertVars;
  'team-invitation': TeamInvitationVars;
};

export interface SendEmailInput<T extends EmailTemplateName = EmailTemplateName> {
  to: string;
  template: T;
  variables: EmailTemplateVars[T];
  subject?: string; // override subject if needed
  replyTo?: string;
  metadata?: Record<string, unknown>;
}

export interface SendEmailResult {
  ok: boolean;
  providerId?: string;
  logId?: string;
  error?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(input: ProviderSendInput): Promise<ProviderSendResult>;
}

export interface ProviderSendInput {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
}

export interface ProviderSendResult {
  id: string;
}
