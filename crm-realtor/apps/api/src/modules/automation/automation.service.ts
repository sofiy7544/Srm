import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ActivityDirection, ActivityType, Prisma, TaskType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { TelegramService } from '../telegram/telegram.service';
import { TemplatesService } from '../templates/templates.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QueueService } from '../queue/queue.service';

interface AssignmentConditions {
  district?: string;
  sourceType?: string;
  dealIntent?: 'BUY' | 'RENT';
}

interface AssignmentAction {
  mode: 'ROUND_ROBIN' | 'FIXED';
  userId?: string;
  poolUserIds?: string[];
}

interface WelcomeAction {
  mode: 'WELCOME_EMAIL';
  templateId: string;
  subject: string;
}

interface FollowupAction {
  mode: 'SCHEDULE_FOLLOWUP';
  days: number;
  title: string;
}

type AnyAction = AssignmentAction | WelcomeAction | FollowupAction;

@Injectable()
export class AutomationService implements OnModuleInit {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly telegram: TelegramService,
    private readonly templates: TemplatesService,
    private readonly notifications: NotificationsService,
    private readonly queue: QueueService,
  ) {}

  onModuleInit() {
    this.queue.register('lead.welcome', (data) => this.runWelcome(data.leadId));
    this.queue.register('lead.followup', (data) => this.createFollowupTask(data.leadId, data.days));
  }

  async runOnLeadCreate(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { client: true, source: true, interestProperty: { select: { district: true } } },
    });
    if (!lead) return;

    const rules = await this.prisma.automationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
    });

    for (const rule of rules) {
      const cond = (rule.condition as unknown as AssignmentConditions) || {};
      const action = rule.action as unknown as AnyAction;

      if (cond.sourceType && lead.source?.type !== cond.sourceType) continue;
      if (cond.dealIntent && lead.dealIntent !== cond.dealIntent) continue;
      if (cond.district) {
        // Match district from the lead's interest property (the more reliable signal).
        const propDistrict = lead.interestProperty?.district ?? '';
        if (!propDistrict.toLowerCase().includes(cond.district.toLowerCase())) continue;
      }

      try {
        await this.applyAction(leadId, action);
      } catch (e) {
        this.logger.error(`Rule "${rule.name}" failed: ${(e as Error).message}`);
      }
    }

    // First-contact SLA: для лідів у стадії NEW створити CALL-задачу на +15 хв.
    // Це і є «не загубити нового» — пряма дія в /today, а не нотифікація.
    if (lead.stage === 'NEW') {
      await this.createFirstContactSlaTask(leadId);
    }

    await this.queue.enqueue('lead.welcome', { leadId });
    await this.queue.enqueue(
      'lead.followup',
      { leadId, days: 3 },
      { delayMs: 3 * 24 * 60 * 60 * 1000, jobId: `followup-3d-${leadId}` },
    );
    await this.queue.enqueue(
      'lead.followup',
      { leadId, days: 7 },
      { delayMs: 7 * 24 * 60 * 60 * 1000, jobId: `followup-7d-${leadId}` },
    );
  }

  private async createFirstContactSlaTask(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { client: true, assignedUser: true },
    });
    if (!lead || !lead.assignedUserId) return;
    const dueAt = new Date(Date.now() + 15 * 60_000); // +15 min
    await this.prisma.task.create({
      data: {
        userId: lead.assignedUserId,
        clientId: lead.clientId,
        leadId: lead.id,
        title: `Перший контакт: ${lead.client.fullName} (SLA 15 хв)`,
        type: TaskType.CALL,
        dueAt,
      },
    });
    await this.notifications.notify({
      userId: lead.assignedUserId,
      type: 'NEW_LEAD_SLA',
      title: 'Новий лід — зв\'яжіться протягом 15 хв',
      body: lead.client.fullName,
      link: `/leads/${leadId}`,
    });
    if (lead.assignedUser?.telegramChatId && this.telegram.isConfigured()) {
      void this.telegram.sendMessage(
        lead.assignedUser.telegramChatId,
        `🔥 Новий лід: ${lead.client.fullName}\nЗателефонувати протягом 15 хв`,
      );
    }
  }

  private async applyAction(leadId: string, action: AnyAction) {
    if ('mode' in action && action.mode === 'ROUND_ROBIN') {
      await this.autoAssignRoundRobin(leadId, action);
    } else if ('mode' in action && action.mode === 'FIXED' && action.userId) {
      await this.assignTo(leadId, action.userId);
    }
  }

  private async autoAssignRoundRobin(leadId: string, action: AssignmentAction) {
    // Pool — explicit list or "all active realtors". Filter by `isAvailable` so
    // agents on vacation/PTO don't get auto-assigned and silently bleed leads.
    const pool = action.poolUserIds?.length
      ? await this.prisma.user.findMany({
          where: { id: { in: action.poolUserIds }, isActive: true, isAvailable: true },
          select: { id: true },
        })
      : await this.prisma.user.findMany({
          where: { role: UserRole.REALTOR, isActive: true, isAvailable: true },
          select: { id: true },
        });
    if (pool.length === 0) {
      this.logger.warn(`Round-robin pool is empty for lead ${leadId} — no available realtor`);
      return;
    }

    // Count *active* leads only — terminal (WON/LOST) shouldn't count against capacity.
    const counts = await this.prisma.lead.groupBy({
      by: ['assignedUserId'],
      where: {
        assignedUserId: { in: pool.map((p) => p.id) },
        stage: { notIn: ['WON', 'LOST'] },
      },
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((c) => [c.assignedUserId, c._count._all]));

    // Tie-break by `assignedUserId` ASC so behaviour is deterministic & testable.
    let chosen = pool[0].id;
    let minLoad = Number.MAX_SAFE_INTEGER;
    for (const u of [...pool].sort((a, b) => a.id.localeCompare(b.id))) {
      const c = countMap.get(u.id) ?? 0;
      if (c < minLoad) {
        minLoad = c;
        chosen = u.id;
      }
    }
    await this.assignTo(leadId, chosen);
  }

  private async assignTo(leadId: string, userId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, clientId: true, assignedUserId: true, client: { select: { fullName: true } } },
    });
    if (!lead || lead.assignedUserId === userId) return;

    await this.prisma.lead.update({
      where: { id: leadId },
      data: { assignedUserId: userId },
    });
    await this.prisma.activity.create({
      data: {
        clientId: lead.clientId,
        leadId,
        type: ActivityType.ASSIGNMENT,
        direction: ActivityDirection.INTERNAL,
        metadata: { from: lead.assignedUserId, to: userId, auto: true } as Prisma.InputJsonValue,
      },
    });
    await this.notifications.notify({
      userId,
      type: 'NEW_LEAD',
      title: 'Вам автоматически назначен лид',
      body: lead.client.fullName,
      link: `/leads/${leadId}`,
    });
  }

  private async runWelcome(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { client: true, assignedUser: true },
    });
    if (!lead) return;

    const welcomeRule = await this.prisma.automationRule.findFirst({
      where: { isActive: true, action: { path: ['mode'], equals: 'WELCOME_EMAIL' } },
    });
    if (!welcomeRule) return;

    const action = welcomeRule.action as unknown as WelcomeAction;
    const tpl = await this.prisma.contractTemplate.findUnique({ where: { id: action.templateId } });
    if (!tpl || !lead.client.email || !this.email.isConfigured()) return;

    const html = this.templates.render(tpl.content, {
      client: lead.client,
      agent: lead.assignedUser ?? { fullName: 'Команда', email: '' },
    });
    const sent = await this.email.send(lead.client.email, action.subject, html);
    if (sent) {
      await this.prisma.activity.create({
        data: {
          clientId: lead.clientId,
          leadId,
          type: ActivityType.EMAIL,
          direction: ActivityDirection.OUT,
          content: `Автоприветствие: ${action.subject}`,
          metadata: { templateId: tpl.id, auto: true } as Prisma.InputJsonValue,
        },
      });
    }
  }

  private async createFollowupTask(leadId: string, days: number) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { assignedUser: true },
    });
    if (!lead || !lead.assignedUserId) return;

    const recentActivity = await this.prisma.activity.findFirst({
      where: {
        leadId,
        type: { in: [ActivityType.CALL, ActivityType.EMAIL, ActivityType.WHATSAPP, ActivityType.TELEGRAM] },
        createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
      },
    });
    if (recentActivity) return;

    if (['WON', 'LOST'].includes(lead.stage)) return;

    await this.prisma.task.create({
      data: {
        userId: lead.assignedUserId,
        clientId: lead.clientId,
        leadId: lead.id,
        title: `Связаться с клиентом (через ${days} дн.)`,
        type: TaskType.FOLLOWUP,
        dueAt: nextWorkDayMorning(),
      },
    });
    await this.notifications.notify({
      userId: lead.assignedUserId,
      type: 'FOLLOWUP_DUE',
      title: 'Пора связаться с клиентом',
      body: `Прошло ${days} дн. без активности`,
      link: `/leads/${leadId}`,
    });

    if (lead.assignedUser?.telegramChatId && this.telegram.isConfigured()) {
      void this.telegram.sendMessage(
        lead.assignedUser.telegramChatId,
        `⏰ Напоминание: свяжитесь с клиентом — прошло ${days} дн. без активности`,
      );
    }
  }
}

function nextWorkDayMorning(): Date {
  const now = new Date();
  const out = new Date(now);
  // If it's already past 18:00, push to tomorrow morning; otherwise today 10:00
  if (now.getHours() >= 18) {
    out.setDate(now.getDate() + 1);
    out.setHours(10, 0, 0, 0);
  } else if (now.getHours() < 10) {
    out.setHours(10, 0, 0, 0);
  } else {
    // sometime today, set due for end of today (18:00) so it lingers in
    // "today" list without going overdue immediately
    out.setHours(18, 0, 0, 0);
  }
  // skip weekend
  const dow = out.getDay();
  if (dow === 6) out.setDate(out.getDate() + 2);
  else if (dow === 0) out.setDate(out.getDate() + 1);
  return out;
}
