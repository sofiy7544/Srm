import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { EmailConfig } from '../email.config';
import {
  EmailProvider,
  ProviderSendInput,
  ProviderSendResult,
} from '../types/email.types';

/**
 * Resend implementation of the EmailProvider interface.
 * Adds a hard timeout around the SDK call and surfaces provider errors
 * in a consistent shape for the upstream service to log and retry.
 */
@Injectable()
export class ResendProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly client: Resend | null;

  constructor(private readonly config: EmailConfig) {
    this.client = config.enabled ? new Resend(config.resendApiKey) : null;
  }

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    if (!this.client) {
      throw new Error('Resend client not initialized (RESEND_API_KEY missing)');
    }

    const send = this.client.emails.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      headers: input.headers,
      tags: input.tags,
    });

    const timeout = new Promise<never>((_, reject) => {
      const t = setTimeout(() => {
        reject(new Error(`Resend send timed out after ${this.config.sendTimeoutMs}ms`));
      }, this.config.sendTimeoutMs);
      // Don't keep the event loop alive for the timeout alone.
      t.unref();
    });

    const result = await Promise.race([send, timeout]);

    if ('error' in result && result.error) {
      const err = result.error;
      const message = typeof err === 'object' && err && 'message' in err
        ? String((err as { message: unknown }).message)
        : JSON.stringify(err);
      throw new Error(`Resend error: ${message}`);
    }

    const data = (result as { data?: { id?: string } | null }).data;
    if (!data?.id) {
      throw new Error('Resend returned no message id');
    }
    return { id: data.id };
  }
}
