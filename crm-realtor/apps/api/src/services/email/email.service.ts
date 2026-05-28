import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailConfig } from './email.config';
import { ResendProvider } from './providers/resend.provider';
import { TemplateRenderer } from './templates/template.renderer';
import { EmailQueueService, EmailJobData } from './email.queue';
import {
  EmailTemplateName,
  SendEmailInput,
  SendEmailResult,
} from './types/email.types';
import { EmailStatus, Prisma } from '@prisma/client';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Centralized email service. All template-based emails go through `send()`.
 *
 * Legacy `sendRaw()` and `isConfigured()` keep the old EmailService API alive
 * for code paths (clients, automation, presentation) that pass already-rendered
 * HTML. New code should always prefer the template-based `send()`.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailConfig: EmailConfig,
    private readonly provider: ResendProvider,
    private readonly renderer: TemplateRenderer,
    private readonly queue: EmailQueueService,
  ) {}

  onModuleInit(): void {
    // Wire the queue worker to actually perform sends (the worker process
    // doesn't know about the renderer/provider until we hand them over).
    this.queue.registerHandler(async (data) => this.performSend(data));
  }

  isConfigured(): boolean {
    return this.emailConfig.enabled;
  }

  /**
   * Template-based send. Default flow is async via BullMQ; pass
   * `EMAIL_SYNC=true` (or queue unavailable) to send inline.
   *
   * Backward-compat overload: `send(to, subject, html)` returns boolean and
   * matches the original EmailService signature.
   */
  async send(to: string, subject: string, html: string): Promise<boolean>;
  async send<T extends EmailTemplateName>(input: SendEmailInput<T>): Promise<SendEmailResult>;
  async send<T extends EmailTemplateName>(
    input: SendEmailInput<T> | string,
    legacySubject?: string,
    legacyHtml?: string,
  ): Promise<SendEmailResult | boolean> {
    if (typeof input === 'string') {
      return this.sendRaw(input, legacySubject ?? '', legacyHtml ?? '');
    }
    return this.sendTemplate(input);
  }

  /**
   * Preferred entrypoint for new code.
   */
  async sendTemplate<T extends EmailTemplateName>(
    input: SendEmailInput<T>,
  ): Promise<SendEmailResult> {
    if (!this.isConfigured()) {
      this.logger.warn(`Email skipped (no API key) → ${input.template} → ${input.to}`);
      return { ok: false, error: 'Email provider not configured' };
    }
    if (!this.validateEmail(input.to)) {
      return { ok: false, error: 'Invalid recipient address' };
    }

    // Resolve subject without rendering the full HTML twice.
    const subject = this.renderer.renderSubject(
      input.template,
      input.variables,
      input.subject,
    );

    const log = await this.prisma.emailLog.create({
      data: {
        toAddress: input.to,
        fromAddress: this.emailConfig.fromFormatted,
        subject,
        template: input.template,
        status: EmailStatus.QUEUED,
        metadata: (input.metadata ?? {}) as Prisma.JsonObject,
      },
    });

    const jobData: EmailJobData = {
      to: input.to,
      template: input.template,
      variables: input.variables as unknown as Record<string, unknown>,
      subject: input.subject,
      replyTo: input.replyTo,
      metadata: input.metadata,
      logId: log.id,
    };

    // Sync path (configured or queue not ready).
    if (this.emailConfig.sync || !this.queue.isReady()) {
      return this.performSend(jobData);
    }

    const enqueued = await this.queue.enqueue(jobData);
    if (!enqueued) {
      return this.performSend(jobData);
    }
    return { ok: true, logId: log.id };
  }

  /**
   * Legacy raw-HTML send used by clients/automation/presentation modules.
   * No template rendering, no log row — kept identical to the previous service
   * so existing call sites continue to work unchanged.
   */
  async sendRaw(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    if (!this.validateEmail(to)) return false;
    try {
      await this.retry(() =>
        this.provider.send({
          from: this.emailConfig.fromFormatted,
          to,
          subject,
          html,
          text: this.fallbackText(html),
          replyTo: this.emailConfig.replyTo,
          headers: { 'X-Entity-Source': 'crm-raw' },
        }),
      );
      return true;
    } catch (e) {
      this.logger.error(`Raw email send failed: ${(e as Error).message}`);
      return false;
    }
  }

  /** Actual send + log update. Called inline or from the queue worker. */
  private async performSend(data: EmailJobData): Promise<SendEmailResult> {
    const { html, text, subject } = this.renderer.render(
      data.template,
      data.variables,
      data.subject,
    );

    try {
      const result = await this.retry(() =>
        this.provider.send({
          from: this.emailConfig.fromFormatted,
          to: data.to,
          subject,
          html,
          text,
          replyTo: data.replyTo ?? this.emailConfig.replyTo,
          headers: { 'X-Entity-Template': data.template },
          tags: [{ name: 'template', value: data.template }],
        }),
      );

      await this.prisma.emailLog
        .update({
          where: { id: data.logId },
          data: {
            status: EmailStatus.SENT,
            providerId: result.id,
            sentAt: new Date(),
            attempts: { increment: 1 },
          },
        })
        .catch((e: unknown) =>
          this.logger.warn(`Email log update failed: ${(e as Error).message}`),
        );

      this.logger.log(
        `Email sent [${data.template}] → ${data.to} (provider id ${result.id})`,
      );
      return { ok: true, providerId: result.id, logId: data.logId };
    } catch (e) {
      const message = (e as Error).message;
      await this.prisma.emailLog
        .update({
          where: { id: data.logId },
          data: {
            status: EmailStatus.FAILED,
            errorMessage: message.slice(0, 1000),
            attempts: { increment: 1 },
          },
        })
        .catch(() => undefined);
      this.logger.error(`Email send failed [${data.template}] → ${data.to}: ${message}`);
      return { ok: false, error: message, logId: data.logId };
    }
  }

  /**
   * Exponential backoff retry. Distinct from BullMQ retry — used inside a
   * single attempt (e.g. transient 5xx from Resend), and inside `sendRaw`
   * which doesn't go through the queue at all.
   */
  private async retry<T>(fn: () => Promise<T>): Promise<T> {
    const maxAttempts = 3;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        if (attempt === maxAttempts) break;
        const delay = this.emailConfig.backoffMs * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  private validateEmail(addr: string): boolean {
    if (!addr || addr.length > 254) return false;
    return EMAIL_REGEX.test(addr);
  }

  /** Last-resort plain text for raw HTML sends. */
  private fallbackText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
