import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import Handlebars from 'handlebars';
import { EmailConfig } from '../email.config';
import {
  BaseTemplateVars,
  EmailTemplateName,
  EmailTemplateVars,
} from '../types/email.types';

interface CompiledTemplate {
  body: HandlebarsTemplateDelegate;
  subject: (vars: Record<string, unknown>) => string;
}

const SUBJECTS: Record<EmailTemplateName, (vars: Record<string, unknown>) => string> = {
  welcome: (v) => `Welcome to ${v.appName}`,
  'verify-email': () => `Verify your email`,
  'reset-password': () => `Reset your password`,
  'login-alert': () => `New sign-in to your account`,
  'team-invitation': (v) => `${v.inviterName} invited you to ${v.appName}`,
};

/**
 * Loads Handlebars templates at module init, compiles them once,
 * and renders body+subject on demand. Templates are wrapped in
 * the shared layout.hbs partial.
 */
@Injectable()
export class TemplateRenderer implements OnModuleInit {
  private readonly logger = new Logger(TemplateRenderer.name);
  private layout!: HandlebarsTemplateDelegate;
  private readonly templates = new Map<EmailTemplateName, CompiledTemplate>();
  private readonly templateNames: EmailTemplateName[] = [
    'welcome',
    'verify-email',
    'reset-password',
    'login-alert',
    'team-invitation',
  ];

  constructor(private readonly config: EmailConfig) {}

  onModuleInit(): void {
    // Walk up from the compiled JS location to find the source `templates` dir.
    // In dev (ts-node/tsx) __dirname points to src/, in build to dist/. Both
    // contain `templates/` after `cp -r` in build step, OR we resolve from src/.
    const dir = this.resolveTemplatesDir();
    const layoutSrc = readFileSync(join(dir, 'partials', 'layout.hbs'), 'utf8');
    this.layout = Handlebars.compile(layoutSrc, { noEscape: false });

    for (const name of this.templateNames) {
      const src = readFileSync(join(dir, `${name}.hbs`), 'utf8');
      this.templates.set(name, {
        body: Handlebars.compile(src),
        subject: SUBJECTS[name],
      });
    }
    this.logger.log(`Loaded ${this.templates.size} email templates`);
  }

  /** Cheap subject-only render so callers can log it without rendering full HTML. */
  renderSubject<T extends EmailTemplateName>(
    name: T,
    vars: EmailTemplateVars[T],
    overrideSubject?: string,
  ): string {
    if (overrideSubject) return overrideSubject;
    const tpl = this.templates.get(name);
    if (!tpl) throw new Error(`Email template not found: ${name}`);
    const merged: Record<string, unknown> = { ...this.baseVars(), ...vars };
    return tpl.subject(merged);
  }

  render<T extends EmailTemplateName>(
    name: T,
    vars: EmailTemplateVars[T],
    overrideSubject?: string,
  ): { html: string; text: string; subject: string };
  render(
    name: EmailTemplateName,
    vars: Record<string, unknown>,
    overrideSubject?: string,
  ): { html: string; text: string; subject: string };
  render(
    name: EmailTemplateName,
    vars: Record<string, unknown>,
    overrideSubject?: string,
  ): { html: string; text: string; subject: string } {
    const tpl = this.templates.get(name);
    if (!tpl) throw new Error(`Email template not found: ${name}`);

    const merged: Record<string, unknown> = {
      ...this.baseVars(),
      ...vars,
    };

    const innerBody = tpl.body(merged);
    const subject = overrideSubject ?? tpl.subject(merged);
    const html = this.layout({ ...merged, body: innerBody, subject });
    const text = this.htmlToText(html);
    return { html, text, subject };
  }

  private baseVars(): BaseTemplateVars {
    return {
      appName: this.config.appName,
      appUrl: this.config.appUrl,
      supportEmail: this.config.supportEmail,
      brandColor: this.config.brandColor,
      accentColor: this.config.accentColor,
      year: new Date().getUTCFullYear(),
    };
  }

  private resolveTemplatesDir(): string {
    // Try compiled location first (dist/services/email/templates), then src.
    const candidates = [
      join(__dirname),
      join(__dirname, '..', 'templates'),
      join(process.cwd(), 'apps', 'api', 'src', 'services', 'email', 'templates'),
      join(process.cwd(), 'src', 'services', 'email', 'templates'),
    ];
    for (const c of candidates) {
      try {
        readFileSync(join(c, 'welcome.hbs'), 'utf8');
        return c;
      } catch {
        /* try next */
      }
    }
    throw new Error('Email templates directory not found');
  }

  /**
   * Basic, dependency-free HTML→text fallback. Email clients that block HTML
   * still get a readable message; not a full Markdown render, just enough
   * to keep the multipart/alternative well-formed.
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  }
}
