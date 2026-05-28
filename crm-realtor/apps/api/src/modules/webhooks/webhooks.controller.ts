import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ActivityType, LeadStage, SourceType } from '@prisma/client';

// Stages that count as "active" — a lead in any of these is being worked on
// and we should NOT create a duplicate from a second inbound on the same phone.
const ACTIVE_LEAD_STAGES: LeadStage[] = [
  LeadStage.NEW,
  LeadStage.CONTACTED,
  LeadStage.QUALIFIED,
  LeadStage.SHOWING,
  LeadStage.NEGOTIATION,
];
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

interface MetaWebhookEntry {
  id: string;
  changes?: Array<{
    value: {
      leadgen_id?: string;
      form_id?: string;
      created_time?: number;
      page_id?: string;
      field_data?: Array<{ name: string; values: string[] }>;
    };
    field: string;
  }>;
}

interface MetaWebhookBody {
  object: string;
  entry?: MetaWebhookEntry[];
}

@Controller('webhooks/meta')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private readonly verifyToken: string | undefined;
  private readonly appSecret: string | undefined;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    this.verifyToken = config.get<string>('META_WEBHOOK_VERIFY_TOKEN') || undefined;
    this.appSecret = config.get<string>('META_APP_SECRET') || undefined;
  }

  @Get()
  @SkipThrottle()
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    if (mode === 'subscribe' && token && this.verifyToken && token === this.verifyToken) {
      this.logger.log('Meta webhook verified');
      return challenge ?? '';
    }
    throw new BadRequestException('Verification failed');
  }

  @Post()
  @HttpCode(200)
  @Throttle({ webhook: { limit: 60, ttl: 60_000 } })
  async receive(
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!this.appSecret) {
      this.logger.error('META_APP_SECRET not set — refusing webhook');
      throw new ForbiddenException('Webhook signing not configured');
    }
    if (!signature || !req.rawBody) {
      throw new ForbiddenException('Missing signature');
    }
    const expected =
      'sha256=' + crypto.createHmac('sha256', this.appSecret).update(req.rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      this.logger.warn('Webhook signature mismatch');
      throw new ForbiddenException('Invalid signature');
    }

    const body = req.body as MetaWebhookBody;
    this.logger.log(`Meta webhook: ${body.object}`);
    if (body.object !== 'page' && body.object !== 'instagram') {
      return { received: true };
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === 'leadgen') {
          await this.handleLeadgen(change.value).catch((e) =>
            this.logger.error(`Lead handling failed: ${(e as Error).message}`),
          );
        }
      }
    }
    return { received: true };
  }

  private async handleLeadgen(value: NonNullable<MetaWebhookEntry['changes']>[number]['value']) {
    const fields = (value.field_data ?? []).reduce<Record<string, string>>((acc, f) => {
      acc[f.name] = f.values[0] ?? '';
      return acc;
    }, {});

    const fullName =
      fields['full_name'] ||
      [fields['first_name'], fields['last_name']].filter(Boolean).join(' ') ||
      'Лид с Meta';
    const phone = fields['phone_number'] || fields['phone'] || '';
    const email = fields['email'] || null;

    if (!phone) {
      this.logger.warn('Skipping lead without phone');
      return;
    }

    const source = await this.prisma.source.findFirst({
      where: { type: SourceType.FB_LEAD_ADS, isActive: true },
    });

    const client = await this.prisma.client.upsert({
      where: { primaryPhone: phone },
      update: { email: email ?? undefined },
      create: {
        fullName,
        primaryPhone: phone,
        email,
        sourceId: source?.id ?? null,
      },
    });

    // Dedup: if the same client already has an ACTIVE lead, we don't create a
    // second one — we just log the re-touch as an Activity on the existing lead.
    // Otherwise two parallel leads sit in the funnel and neither agent calls
    // ("the other one will do it"), and the client is effectively lost.
    const existingActive = await this.prisma.lead.findFirst({
      where: { clientId: client.id, stage: { in: ACTIVE_LEAD_STAGES } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, assignedUserId: true },
    });

    if (existingActive) {
      await this.prisma.activity.create({
        data: {
          clientId: client.id,
          leadId: existingActive.id,
          type: ActivityType.NOTE,
          content: 'Повторный лид с Meta Lead Ads — клиент уже в работе, привязан к существующему лиду',
          metadata: {
            leadgenId: value.leadgen_id,
            formId: value.form_id,
            pageId: value.page_id,
            fields,
          },
        },
      });
      await this.prisma.lead.update({
        where: { id: existingActive.id },
        data: { lastActivityAt: new Date() },
      });
      // Ping the assigned agent (if any) so they know the client wrote again.
      if (existingActive.assignedUserId) {
        await this.notifications.notify({
          userId: existingActive.assignedUserId,
          type: 'NEW_LEAD',
          title: 'Повторное обращение клиента',
          body: `${fullName} снова написал. Лид уже у вас.`,
          link: `/leads/${existingActive.id}`,
        }).catch(() => undefined);
      }
      this.logger.log(
        `Skipped duplicate lead creation — client ${client.id} already has active lead ${existingActive.id}`,
      );
      return;
    }

    const lead = await this.prisma.lead.create({
      data: {
        clientId: client.id,
        sourceId: source?.id,
      },
    });

    await this.prisma.activity.create({
      data: {
        clientId: client.id,
        leadId: lead.id,
        type: ActivityType.NOTE,
        content: 'Лид получен через Meta Lead Ads',
        metadata: {
          leadgenId: value.leadgen_id,
          formId: value.form_id,
          pageId: value.page_id,
          fields,
        },
      },
    });

    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true },
    });
    for (const a of admins) {
      await this.notifications.notify({
        userId: a.id,
        type: 'NEW_LEAD',
        title: 'Новый лид с Meta Ads',
        body: `${fullName} · ${phone}`,
        link: `/leads/${lead.id}`,
      });
    }
  }
}
