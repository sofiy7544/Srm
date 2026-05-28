import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Headers,
  UnauthorizedException,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type CurrentUserPayload } from '../auth/current-user.decorator';
import { TelegramService } from './telegram.service';

/**
 * TelegramController
 *
 * POST /api/telegram/webhook  — receives Telegram Update objects (public, verified by secret token)
 * POST /api/telegram/setup    — registers the webhook URL with Telegram (ADMIN only)
 * GET  /api/telegram/status   — returns bot configuration status (ADMIN / MANAGER)
 */
@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);
  private readonly webhookSecret: string | undefined;

  constructor(
    private readonly telegram: TelegramService,
    config: ConfigService,
  ) {
    this.webhookSecret = config.get<string>('TELEGRAM_WEBHOOK_SECRET') || undefined;
  }

  // ─── Incoming webhook from Telegram ───────────────────────────────────────

  /**
   * Telegram calls this endpoint for every incoming Update.
   * Verified via X-Telegram-Bot-Api-Secret-Token header.
   * Must return 200 quickly — heavy work is fire-and-forget.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: Record<string, unknown>,
  ) {
    if (this.webhookSecret && secret !== this.webhookSecret) {
      this.logger.warn('Webhook secret mismatch — ignoring update');
      throw new UnauthorizedException('Invalid webhook secret');
    }

    // Fire-and-forget: never block Telegram's delivery timeout (10 s)
    setImmediate(() => {
      this.telegram
        .processUpdate(update)
        .catch((e) => this.logger.error(`processUpdate error: ${(e as Error).message}`));
    });

    return { ok: true };
  }

  // ─── Admin endpoints ───────────────────────────────────────────────────────

  /**
   * Register (or re-register) the webhook URL with Telegram.
   * Body: { webhookUrl: string }
   * The URL must be publicly reachable HTTPS.
   */
  @Post('setup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async setupWebhook(
    @CurrentUser() _actor: CurrentUserPayload,
    @Body('webhookUrl') webhookUrl: string,
  ) {
    if (!webhookUrl?.startsWith('https://')) {
      throw new BadRequestException('webhookUrl must be a valid HTTPS URL');
    }
    const result = await this.telegram.registerWebhook(webhookUrl);
    return result;
  }

  /**
   * Returns current bot status: configured, username, webhook info.
   */
  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async getStatus() {
    return this.telegram.getStatus();
  }
}
