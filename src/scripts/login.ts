import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { config } from '../config/index.js';
import { log } from '../lib/logger.js';

/**
 * One-time interactive login. Opens the persistent Chrome profile with both
 * Telegram Web and the SMS panel so you can sign in by hand (scan the
 * Telegram QR, log into the panel). Everything is saved to USER_DATA_DIR;
 * afterwards `npm run dev` reuses these sessions. Close the window to finish.
 */
async function main(): Promise<void> {
  const userDataDir = resolve(process.cwd(), config.USER_DATA_DIR);
  log.info('Opening browser for login', { userDataDir });

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });

  const tg = await context.newPage();
  await tg.goto('https://web.telegram.org/k/');

  const panel = await context.newPage();
  await panel.goto(config.SMS_PANEL_URL);

  log.info('Log into Telegram Web (scan QR) and the SMS panel, then close the window.');
  await context.waitForEvent('close', { timeout: 0 });
}

void main();
