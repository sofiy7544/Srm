import { chromium, type BrowserContext, type Page } from 'playwright';
import { resolve } from 'node:path';
import { config } from '../config/index.js';
import { log } from '../lib/logger.js';

/**
 * Owns a single persistent Chrome context so that logins to Telegram Web and
 * the SMS panel survive restarts (stored under USER_DATA_DIR). We keep one
 * long-lived page per concern rather than opening/closing tabs per action.
 */
export class BrowserManager {
  private context: BrowserContext | null = null;
  private telegramPage: Page | null = null;
  private smsPage: Page | null = null;

  async start(): Promise<void> {
    if (this.context) return;
    const userDataDir = resolve(process.cwd(), config.USER_DATA_DIR);
    log.info('Launching Chrome', { userDataDir, headless: config.HEADLESS });
    this.context = await chromium.launchPersistentContext(userDataDir, {
      headless: config.HEADLESS,
      slowMo: config.SLOW_MO,
      viewport: { width: 1280, height: 900 },
    });
  }

  private async page(current: Page | null, url: string): Promise<Page> {
    if (current && !current.isClosed()) return current;
    if (!this.context) throw new Error('BrowserManager not started');
    const page = await this.context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return page;
  }

  async telegram(): Promise<Page> {
    this.telegramPage = await this.page(this.telegramPage, 'https://web.telegram.org/k/');
    return this.telegramPage;
  }

  async sms(): Promise<Page> {
    this.smsPage = await this.page(this.smsPage, config.SMS_PANEL_URL);
    return this.smsPage;
  }

  async stop(): Promise<void> {
    await this.context?.close();
    this.context = null;
    this.telegramPage = null;
    this.smsPage = null;
  }
}
