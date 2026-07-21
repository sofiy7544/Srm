import type { Page } from 'playwright';
import { log } from '../lib/logger.js';

/**
 * Posts a reply back into the currently-open Telegram Web chat — the "SMS
 * отправлен на …" report. Assumes the target group is already open (the
 * watcher opened it), so it just types into the composer.
 */
export class TelegramReporter {
  constructor(private readonly page: Page) {}

  async send(text: string): Promise<void> {
    const input = this.page.locator('.input-message-input[contenteditable="true"]').last();
    await input.waitFor({ state: 'visible', timeout: 15_000 });
    await input.click();
    await input.fill(text);
    await this.page.keyboard.press('Enter');
    log.info('Reported to group', { text });
  }
}
