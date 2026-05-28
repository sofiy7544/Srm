import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

/**
 * Canonical notification types. App-level enum (DB column is TEXT for portability).
 * Catches typos at compile-time — silent typos used to land "NEW_TASKS" etc.
 */
export const NOTIFICATION_TYPES = [
  'NEW_LEAD',
  'NEW_LEAD_SLA',
  'NEW_TASK',
  'TASK_REASSIGNED',
  'FOLLOWUP_DUE',
  'LEAD_IDLE',
  'LEAD_LOST_REOPEN',
  'NEW_MESSAGE',
  'SHOWING_REMINDER',
  'DEAL_CREATED',
  'DEAL_CLOSED_WON',
  'MENTION',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegram: TelegramService,
  ) {}

  async notify(args: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
    sendTelegram?: boolean;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: args.userId,
        type: args.type,
        title: args.title,
        body: args.body,
        link: args.link,
      },
    });

    if (args.sendTelegram !== false && this.telegram.isConfigured()) {
      const user = await this.prisma.user.findUnique({
        where: { id: args.userId },
        select: { telegramChatId: true },
      });
      if (user?.telegramChatId) {
        const text = `<b>${escapeHtml(args.title)}</b>${
          args.body ? `\n${escapeHtml(args.body)}` : ''
        }${args.link ? `\n${args.link}` : ''}`;
        void this.telegram.sendMessage(user.telegramChatId, text);
      }
    }

    return notification;
  }

  listForUser(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
}
