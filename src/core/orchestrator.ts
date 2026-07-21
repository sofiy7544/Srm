import { BrowserManager } from '../browser/manager.js';
import { TelegramWatcher, type IncomingMessage } from '../telegram/watcher.js';
import { TelegramReporter } from '../telegram/reporter.js';
import { SmsSender } from '../sms/sender.js';
import { parseTrigger } from '../parser/trigger.js';
import { log } from '../lib/logger.js';

export interface Stats {
  running: boolean;
  processed: number;
  sent: number;
  failed: number;
  lastError: string | null;
}

/**
 * Top-level pipeline: Telegram message -> parse -> send SMS -> report back.
 * Requests are serialised (one at a time) because a single browser drives
 * both the Telegram tab and the SMS tab.
 */
export class Orchestrator {
  private browser = new BrowserManager();
  private watcher: TelegramWatcher | null = null;
  private queue: Promise<void> = Promise.resolve();

  readonly stats: Stats = { running: false, processed: 0, sent: 0, failed: 0, lastError: null };

  async start(): Promise<void> {
    if (this.stats.running) return;
    await this.browser.start();

    const tgPage = await this.browser.telegram();
    const reporter = new TelegramReporter(tgPage);
    const smsPage = await this.browser.sms();
    const sender = new SmsSender(smsPage);

    this.watcher = new TelegramWatcher(tgPage, (msg) => this.enqueue(msg, sender, reporter));
    await this.watcher.openGroup();
    this.watcher.start();

    this.stats.running = true;
    log.info('Orchestrator started');
  }

  private enqueue(msg: IncomingMessage, sender: SmsSender, reporter: TelegramReporter): Promise<void> {
    this.queue = this.queue.then(() => this.handle(msg, sender, reporter));
    return this.queue;
  }

  private async handle(msg: IncomingMessage, sender: SmsSender, reporter: TelegramReporter): Promise<void> {
    const req = parseTrigger(msg.text);
    if (!req) return;

    this.stats.processed += 1;
    log.info('Trigger matched', { phone: req.phone, from: req.from });

    try {
      const result = await sender.send(req);
      if (result.ok) {
        this.stats.sent += 1;
        const tag = result.dryRun ? ' (тест, не отправлено)' : '';
        await reporter.send(`✅ SMS отправлен на ${req.phone} — от ${req.from}${tag}`);
      } else {
        this.stats.failed += 1;
        this.stats.lastError = result.detail ?? 'unknown';
        await reporter.send(`⚠️ Не удалось отправить SMS на ${req.phone}: ${result.detail ?? 'ошибка'}`);
      }
    } catch (err) {
      this.stats.failed += 1;
      this.stats.lastError = String(err);
      log.error('Send pipeline failed', String(err));
      await reporter.send(`⚠️ Ошибка при отправке SMS на ${req.phone}`).catch(() => undefined);
    }
  }

  async stop(): Promise<void> {
    this.watcher?.stop();
    await this.browser.stop();
    this.stats.running = false;
    log.info('Orchestrator stopped');
  }
}
