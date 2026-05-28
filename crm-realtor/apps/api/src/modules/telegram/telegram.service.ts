import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityDirection, ActivityType, ContactChannel, LeadStage, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

interface TgUser { id: number; first_name: string; last_name?: string; username?: string; }
interface TgChat { id: number; type: 'private' | 'group' | 'supergroup' | 'channel'; }
interface TgMessage { message_id: number; from?: TgUser; chat: TgChat; text?: string; caption?: string; date: number; }
interface TgUpdate { update_id: number; message?: TgMessage; edited_message?: TgMessage; }

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string | undefined;
  private readonly webhookSecret: string | undefined;
  private readonly apiBase = 'https://api.telegram.org';

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notifications: NotificationsService,
  ) {
    this.token         = config.get<string>('TELEGRAM_BOT_TOKEN')     || undefined;
    this.webhookSecret = config.get<string>('TELEGRAM_WEBHOOK_SECRET') || undefined;
    if (!this.token) this.logger.warn('TELEGRAM_BOT_TOKEN not set');
  }

  isConfigured(): boolean { return Boolean(this.token); }

  async sendMessage(chatId: string, text: string): Promise<boolean> {
    if (!this.token) return false;
    try {
      const res = await fetch(`${this.apiBase}/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      });
      if (!res.ok) { this.logger.error(`sendMessage failed: ${res.status}`); return false; }
      return true;
    } catch (e) { this.logger.error(`sendMessage: ${(e as Error).message}`); return false; }
  }

  async registerWebhook(webhookUrl: string): Promise<{ ok: boolean; description?: string }> {
    if (!this.token) return { ok: false, description: 'TELEGRAM_BOT_TOKEN not configured' };
    try {
      const res = await fetch(`${this.apiBase}/bot${this.token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${webhookUrl}/api/telegram/webhook`,
          allowed_updates: ['message', 'edited_message'],
          drop_pending_updates: true,
          ...(this.webhookSecret ? { secret_token: this.webhookSecret } : {}),
        }),
      });
      const data = (await res.json()) as { ok: boolean; description?: string };
      if (data.ok) this.logger.log(`Webhook registered: ${webhookUrl}/api/telegram/webhook`);
      else this.logger.error(`setWebhook failed: ${data.description}`);
      return data;
    } catch (e) { return { ok: false, description: (e as Error).message }; }
  }

  async getStatus(): Promise<{ configured: boolean; botUsername?: string; webhookUrl?: string; pendingUpdateCount?: number; lastError?: string }> {
    if (!this.token) return { configured: false };
    try {
      const [meRes, whRes] = await Promise.all([
        fetch(`${this.apiBase}/bot${this.token}/getMe`),
        fetch(`${this.apiBase}/bot${this.token}/getWebhookInfo`),
      ]);
      const me = (await meRes.json()) as { ok: boolean; result?: { username: string } };
      const wh = (await whRes.json()) as { ok: boolean; result?: { url: string; pending_update_count: number; last_error_message?: string } };
      return { configured: true, botUsername: me.result?.username, webhookUrl: wh.result?.url || '(not set)', pendingUpdateCount: wh.result?.pending_update_count ?? 0, lastError: wh.result?.last_error_message };
    } catch (e) { return { configured: true, lastError: (e as Error).message }; }
  }

  async processUpdate(raw: Record<string, unknown>): Promise<void> {
    const update = raw as unknown as TgUpdate;
    const tgMsg = update.message ?? update.edited_message;
    if (!tgMsg || tgMsg.chat.type !== 'private') return;
    const text = (tgMsg.text ?? tgMsg.caption)?.trim();
    if (!text) return;
    const chatId = String(tgMsg.chat.id);
    const msgId  = String(tgMsg.message_id);
    const dup = await this.prisma.message.findUnique({ where: { channel_externalId: { channel: ContactChannel.TELEGRAM, externalId: msgId } } });
    if (dup) return;
    const { client, isNew } = await this.findOrCreateClient(chatId, tgMsg.from);
    const activity = await this.prisma.activity.create({
      data: { clientId: client.id, userId: null, type: ActivityType.TELEGRAM, direction: ActivityDirection.IN, content: text, metadata: { telegramMsgId: tgMsg.message_id, telegramChatId: chatId, username: tgMsg.from?.username ?? null } as Prisma.InputJsonValue },
    });
    await this.prisma.message.create({
      data: { activityId: activity.id, channel: ContactChannel.TELEGRAM, externalId: msgId, from: tgMsg.from ? this.formatSender(tgMsg.from) : chatId, to: null, body: text, deliveredAt: new Date(tgMsg.date * 1000) },
    });
    if (isNew) {
      const source = await this.prisma.source.findFirst({ where: { type: 'TELEGRAM' }, select: { id: true } });
      await this.prisma.lead.create({ data: { clientId: client.id, sourceId: source?.id ?? null, stage: LeadStage.NEW, assignedUserId: client.assignedUserId ?? null } });
      this.logger.log(`Auto-created lead for Telegram chatId=${chatId}`);
    }
    await this.notifyAgent(client.id, text);
  }

  private async findOrCreateClient(chatId: string, from?: TgUser): Promise<{ client: { id: string; assignedUserId: string | null }; isNew: boolean }> {
    const ex = await this.prisma.clientContact.findFirst({ where: { channel: ContactChannel.TELEGRAM, identifier: chatId }, include: { client: { select: { id: true, assignedUserId: true } } } });
    if (ex) return { client: ex.client, isNew: false };
    const name = from ? ([from.first_name, from.last_name].filter(Boolean).join(' ') || (from.username ? `@${from.username}` : `Telegram ${from.id}`)) : `Telegram ${chatId}`;
    const c = await this.prisma.client.create({
      data: { fullName: name, primaryPhone: `tg_${chatId}`, notes: from?.username ? `Telegram: @${from.username}` : `chat_id: ${chatId}`, contacts: { create: { channel: ContactChannel.TELEGRAM, identifier: chatId, isPrimary: true } } },
      select: { id: true, assignedUserId: true },
    });
    return { client: c, isNew: true };
  }

  private formatSender(from: TgUser): string {
    const name = [from.first_name, from.last_name].filter(Boolean).join(' ');
    return from.username ? `${name} (@${from.username})` : name;
  }

  private async notifyAgent(clientId: string, text: string): Promise<void> {
    const c = await this.prisma.client.findUnique({ where: { id: clientId }, select: { fullName: true, assignedUserId: true, leads: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } } });
    if (!c?.assignedUserId) return;
    await this.notifications.notify({ userId: c.assignedUserId, type: 'NEW_MESSAGE', title: `Telegram: ${c.fullName}`, body: text.length > 60 ? `${text.slice(0, 57)}...` : text, link: c.leads[0]?.id ? `/leads/${c.leads[0].id}` : `/clients/${clientId}` });
  }
}
