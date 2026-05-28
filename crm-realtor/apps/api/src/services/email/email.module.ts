import { Global, Module } from '@nestjs/common';
import { EmailConfig } from './email.config';
import { ResendProvider } from './providers/resend.provider';
import { TemplateRenderer } from './templates/template.renderer';
import { EmailQueueService } from './email.queue';
import { EmailService } from './email.service';
import { EmailTokenService } from './email-token.service';

/**
 * Global email module — `EmailService` is available everywhere without
 * importing it explicitly. Replaces the old `modules/email` module.
 */
@Global()
@Module({
  providers: [
    EmailConfig,
    ResendProvider,
    TemplateRenderer,
    EmailQueueService,
    EmailService,
    EmailTokenService,
  ],
  exports: [EmailService, EmailTokenService, EmailConfig],
})
export class EmailModule {}
