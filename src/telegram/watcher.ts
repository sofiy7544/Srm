import type { Page } from 'playwright';
import { config } from '../config/index.js';
import { log } from '../lib/logger.js';

export interface IncomingMessage {
  id: string;
  text: string;
}

/**
 * Reads the currently-open chat on Telegram Web (K version) by polling the
 * DOM. This is deliberately no-bot: it observes the group exactly like a
 * person with the window open. Telegram Web markup changes over time, so the
 * message-node selectors below are the most likely thing to need tuning.
 */
export class TelegramWatcher {
  private seen = new Set<string>();
  private primed = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly page: Page,
    private readonly onMessage: (msg: IncomingMessage) => Promise<void>,
  ) {}

  /** Open the target group by title before polling starts. */
  async openGroup(): Promise<void> {
    const title = config.TG_GROUP_TITLE;
    log.info('Opening Telegram group', { title });
    const chat = this.page.locator('.chatlist a.chatlist-chat', { hasText: title }).first();
    await chat.waitFor({ state: 'visible', timeout: 60_000 });
    await chat.click();
    await this.page.locator('.bubbles').first().waitFor({ state: 'visible', timeout: 30_000 });
  }

  start(): void {
    this.timer = setInterval(() => {
      void this.poll();
    }, config.TG_POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async poll(): Promise<void> {
    let messages: IncomingMessage[];
    try {
      messages = await this.readMessages();
    } catch (err) {
      log.warn('Telegram poll failed', String(err));
      return;
    }

    for (const msg of messages) {
      if (this.seen.has(msg.id)) continue;
      this.seen.add(msg.id);
      // First pass only records existing history so we never fire on backlog.
      if (!this.primed) continue;
      try {
        await this.onMessage(msg);
      } catch (err) {
        log.error('onMessage handler threw', String(err));
      }
    }

    if (!this.primed) {
      this.primed = true;
      log.info('Telegram watcher primed', { backlog: this.seen.size });
    }
  }

  private async readMessages(): Promise<IncomingMessage[]> {
    return this.page.$$eval('.bubbles .bubble[data-mid]', (nodes) =>
      nodes.map((n) => ({
        id: n.getAttribute('data-mid') ?? '',
        text: (n.querySelector('.message')?.textContent ?? '').trim(),
      })),
    );
  }
}
