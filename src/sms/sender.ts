import type { Page } from 'playwright';
import { config } from '../config/index.js';
import { log } from '../lib/logger.js';
import type { SmsRequest } from '../parser/trigger.js';

export interface SendResult {
  ok: boolean;
  dryRun: boolean;
  detail?: string;
}

/**
 * Drives the SMS web panel: fills phone / sender / text and submits. All
 * selectors come from config because they are panel-specific. Honours
 * DRY_RUN by doing everything except the final submit click.
 */
export class SmsSender {
  constructor(private readonly page: Page) {}

  async send(req: SmsRequest): Promise<SendResult> {
    log.info('Filling SMS form', { phone: req.phone, from: req.from });

    // Re-navigate for a clean form each time (panels often keep stale state).
    await this.page.goto(config.SMS_PANEL_URL, { waitUntil: 'domcontentloaded' });

    await this.fill(config.SMS_SEL_PHONE, req.phone);
    await this.fill(config.SMS_SEL_FROM, req.from);
    await this.fill(config.SMS_SEL_TEXT, req.text);

    if (config.DRY_RUN) {
      log.warn('DRY_RUN — skipping submit', { phone: req.phone });
      return { ok: true, dryRun: true, detail: 'submit skipped (DRY_RUN)' };
    }

    await this.page.locator(config.SMS_SEL_SUBMIT).click();

    if (config.SMS_SEL_SUCCESS) {
      try {
        await this.page.locator(config.SMS_SEL_SUCCESS).waitFor({ state: 'visible', timeout: 15_000 });
      } catch {
        return { ok: false, dryRun: false, detail: 'success indicator not seen' };
      }
    }

    return { ok: true, dryRun: false };
  }

  private async fill(selector: string, value: string): Promise<void> {
    const field = this.page.locator(selector);
    await field.waitFor({ state: 'visible', timeout: 15_000 });
    await field.fill(value);
  }
}
