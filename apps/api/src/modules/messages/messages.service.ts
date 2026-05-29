import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityDirection,
  ActivityType,
  ContactChannel,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import type { CurrentUserPayload } from '../auth/current-user.decorator';

const CHANNEL_TO_ACTIVITY: Record<ContactChannel, ActivityType> = {
  WHATSAPP: ActivityType.WHATSAPP,
  TELEGRAM: ActivityType.TELEGRAM,
  INSTAGRAM: ActivityType.INSTAGRAM,
  EMAIL: ActivityType.EMAIL,
  VIBER: ActivityType.NOTE,
  PHONE: ActivityType.CALL,
};

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  async listForClient(clientId: string, channel?: ContactChannel) {
    const activityType = channel ? CHANNEL_TO_ACTIVITY[channel] : undefined;
    const messages = await this.prisma.message.findMany({
      where: {
        ...(channel ? { channel } : {}),
        activity: { clientId },
      },
      include: {
        activity: {
          select: { id: true, direction: true, userId: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    if (!channel) return messages;

    const fallbackActivities = await this.prisma.activity.findMany({
      where: {
        clientId,
        type: activityType,
        message: null,
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    return [
      ...messages,
      ...fallbackActivities.map((a) => ({
        id: `activity-${a.id}`,
        activityId: a.id,
        channel: channel,
        externalId: null,
        from: null,
        to: null,
        body: a.content,
        attachments: null,
        deliveredAt: null,
        readAt: null,
        createdAt: a.createdAt,
        activity: { id: a.id, direction: a.direction, userId: a.userId, createdAt: a.createdAt },
      })),
    ].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  async send(
    actor: CurrentUserPayload,
    clientId: string,
    input: { channel: ContactChannel; body: string },
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { contacts: true },
    });
    if (!client) throw new NotFoundException('Клиент не найден');
    if (!input.body.trim()) throw new BadRequestException('Пустое сообщение');

    const contact =
      client.contacts.find((c: any) => c.channel === input.channel && c.isPrimary) ??
      client.contacts.find((c: any) => c.channel === input.channel) ??
      null;

    let delivered = false;
    let note: string | null = null;
    if (input.channel === ContactChannel.TELEGRAM && contact && this.telegram.isConfigured()) {
      const identifier = contact.identifier.replace(/^@/, '');
      if (/^\d+$/.test(identifier)) {
        delivered = await this.telegram.sendMessage(identifier, input.body);
      } else {
        note = 'Telegram username — отправка возможна только при наличии chat_id';
      }
    } else if (input.channel === ContactChannel.TELEGRAM && !this.telegram.isConfigured()) {
      note = 'Telegram-бот не настроен (TELEGRAM_BOT_TOKEN отсутствует)';
    } else if (input.channel === ContactChannel.WHATSAPP) {
      note = 'WhatsApp Business API ещё не подключён, сообщение сохранено в истории';
    }

    const activity = await this.prisma.activity.create({
      data: {
        clientId,
        userId: actor.userId,
        type: CHANNEL_TO_ACTIVITY[input.channel],
        direction: ActivityDirection.OUT,
        content: input.body.trim(),
        metadata: {
          channel: input.channel,
          delivered,
          ...(note ? { note } : {}),
        } as Prisma.InputJsonValue,
      },
    });

    const message = await this.prisma.message.create({
      data: {
        activityId: activity.id,
        channel: input.channel,
        from: actor.email,
        to: contact?.identifier ?? client.primaryPhone,
        body: input.body.trim(),
        deliveredAt: delivered ? new Date() : null,
      },
    });

    return { message, activity, delivered, note };
  }
}
