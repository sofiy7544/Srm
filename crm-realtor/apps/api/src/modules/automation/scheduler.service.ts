import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeadStage, TaskStatus, TaskType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const STALE_DAYS = 7;          // unified with frontend (today/leads/leads.[id])
const REENGAGE_MONTHS = 6;     // WON-client check-in cadence

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async markOverdueTasks() {
    const now = new Date();
    const { count } = await this.prisma.task.updateMany({
      where: { status: TaskStatus.PENDING, dueAt: { lt: now } },
      data: { status: TaskStatus.OVERDUE },
    });
    if (count > 0) {
      this.logger.log(`Marked ${count} tasks as OVERDUE`);
    }
  }

  /**
   * SLA escalation — every 5 min, look at SLA-tagged first-contact tasks that
   * went OVERDUE and ping the responsible chain:
   *   T+0     — SLA task created (по `automation.service.createFirstContactSlaTask`)
   *   T+15    — `markOverdueTasks` flips status to OVERDUE
   *   T+30    — notify the assignee's manager (this method)
   *   T+60    — auto-reopen the lead for re-claim by another agent (clear assignedUserId)
   * Idempotent: уведомление и эскалация маркируются в `Task.description` чтобы
   * не повторяться при следующем тике.
   */
  @Cron('*/5 * * * *')
  async escalateSlaTasks() {
    const now = Date.now();
    const overdueSlaTasks = await this.prisma.task.findMany({
      where: {
        status: TaskStatus.OVERDUE,
        type: TaskType.CALL,
        title: { startsWith: 'Перший контакт:' },
        dueAt: { lt: new Date(now - 15 * 60_000) }, // overdue by at least 15 min
      },
      select: {
        id: true,
        userId: true,
        leadId: true,
        dueAt: true,
        description: true,
        user: { select: { managerId: true, fullName: true } },
        lead: {
          select: {
            id: true,
            stage: true,
            clientId: true,
            client: { select: { fullName: true } },
          },
        },
      },
    });

    for (const t of overdueSlaTasks) {
      if (!t.lead) continue;
      const minutesOverdue = Math.floor((now - t.dueAt.getTime()) / 60_000);
      const tags = new Set((t.description || '').match(/\[sla:(\w+)\]/g) ?? []);

      // T+30: notify manager once
      if (minutesOverdue >= 30 && !tags.has('[sla:manager_notified]')) {
        if (t.user.managerId) {
          await this.notifications.notify({
            userId: t.user.managerId,
            type: 'NEW_LEAD_SLA',
            title: 'SLA: перший контакт прострочено',
            body: `${t.user.fullName} не звʼязався з ${t.lead.client.fullName} за 30 хв`,
            link: `/leads/${t.lead.id}`,
          });
        }
        await this.prisma.task.update({
          where: { id: t.id },
          data: { description: `${t.description ?? ''} [sla:manager_notified]`.trim() },
        });
      }

      // T+60: auto-reopen lead (clear assignedUserId so somebody else can claim)
      // BUT only if the lead is still in the first-contact stage. If the agent
      // moved it to CONTACTED/SHOWING/NEGOTIATION since the SLA task was created,
      // the contact obviously happened — just close the stale task and bail out.
      if (minutesOverdue >= 60 && !tags.has('[sla:reopened]')) {
        const isEarlyStage = t.lead.stage === 'NEW';
        if (!isEarlyStage) {
          await this.prisma.task.update({
            where: { id: t.id },
            data: {
              description: `${t.description ?? ''} [sla:stale_skipped]`.trim(),
              status: TaskStatus.DONE,
              completedAt: new Date(),
            },
          });
          this.logger.log(
            `SLA task ${t.id} skipped: lead ${t.lead.id} already at stage ${t.lead.stage}`,
          );
          continue;
        }
        await this.prisma.lead.update({
          where: { id: t.lead.id },
          data: { assignedUserId: null },
        });
        await this.prisma.task.update({
          where: { id: t.id },
          data: {
            description: `${t.description ?? ''} [sla:manager_notified] [sla:reopened]`.trim(),
            status: TaskStatus.DONE, // close the dead SLA task
            completedAt: new Date(),
          },
        });
        // Notify all admins/managers — lead is back in the pond
        const supervisors = await this.prisma.user.findMany({
          where: {
            isActive: true,
            role: { in: [UserRole.ADMIN, UserRole.MANAGER] },
          },
          select: { id: true },
        });
        for (const sup of supervisors) {
          await this.notifications.notify({
            userId: sup.id,
            type: 'LEAD_LOST_REOPEN',
            title: 'Лід повернувся у пул',
            body: `SLA-прострочено на 60 хв. ${t.lead.client.fullName}`,
            link: `/leads/${t.lead.id}`,
          });
        }
        this.logger.warn(`Lead ${t.lead.id} re-pooled after 60-min SLA breach`);
      }
    }
  }

  /**
   * Daily 9:00 — surface truly stalled leads. "Stalled" = no Activity for STALE_DAYS,
   * not just stage unchanged. A lead in CONTACTED with daily WhatsApp still counts as
   * active. This eliminates the false-positive noise from the old stageChangedAt check.
   */
  @Cron('0 9 * * *')
  async checkIdleLeads() {
    const threshold = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

    const idleLeads = await this.prisma.lead.findMany({
      where: {
        stage: { notIn: [LeadStage.WON, LeadStage.LOST] },
        assignedUserId: { not: null },
        lastActivityAt: { lt: threshold },
      },
      select: {
        id: true,
        assignedUserId: true,
        clientId: true,
        lastActivityAt: true,
        client: { select: { fullName: true } },
      },
    });

    // Compute the start of today once.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let created = 0;
    for (const lead of idleLeads) {
      if (!lead.assignedUserId) continue;

      // Avoid creating a duplicate FOLLOWUP task today for the same lead.
      const existing = await this.prisma.task.findFirst({
        where: {
          leadId: lead.id,
          type: TaskType.FOLLOWUP,
          createdAt: { gte: todayStart },
        },
        select: { id: true },
      });
      if (existing) continue;

      const days = Math.floor((Date.now() - lead.lastActivityAt.getTime()) / 86_400_000);
      const dueAt = new Date();
      dueAt.setHours(10, 0, 0, 0); // today 10:00

      await this.prisma.task.create({
        data: {
          userId: lead.assignedUserId,
          clientId: lead.clientId,
          leadId: lead.id,
          title: `Поновити рух: ${lead.client.fullName} — ${days} дн. без активності`,
          type: TaskType.FOLLOWUP,
          dueAt,
        },
      });
      await this.notifications.notify({
        userId: lead.assignedUserId,
        type: 'LEAD_IDLE',
        title: 'Лід давно без руху',
        body: `${lead.client.fullName} — ${days} дн. без активності`,
        link: `/leads/${lead.id}`,
      });
      created += 1;
    }
    if (created > 0) {
      this.logger.log(`Created ${created} stale-lead tasks`);
    }
  }

  /**
   * Daily 9:30 — every WON deal that closed N months ago gets one re-engagement
   * FOLLOWUP task. A WON client today is a referral source tomorrow.
   */
  @Cron('30 9 * * *')
  async reengageWonClients() {
    // Window: deals closed between (now - REENGAGE_MONTHS - 1day) and (now - REENGAGE_MONTHS)
    const now = new Date();
    const windowEnd = new Date(now);
    windowEnd.setMonth(windowEnd.getMonth() - REENGAGE_MONTHS);
    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() - 1);

    const deals = await this.prisma.deal.findMany({
      where: {
        status: 'COMPLETED',
        closedAt: { gte: windowStart, lt: windowEnd },
      },
      select: {
        id: true,
        agentId: true,
        clientId: true,
        client: { select: { fullName: true, isArchived: true, isBlacklisted: true } },
      },
    });

    let created = 0;
    for (const deal of deals) {
      if (deal.client.isArchived || deal.client.isBlacklisted) continue;

      // Skip if there's already a re-engagement task created in the last 7 days
      const recent = await this.prisma.task.findFirst({
        where: {
          clientId: deal.clientId,
          type: TaskType.FOLLOWUP,
          createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
        },
        select: { id: true },
      });
      if (recent) continue;

      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + 1);
      dueAt.setHours(11, 0, 0, 0);

      await this.prisma.task.create({
        data: {
          userId: deal.agentId,
          clientId: deal.clientId,
          title: `Перевірити ${deal.client.fullName} — ${REENGAGE_MONTHS} міс після угоди (реферал/повторна угода?)`,
          type: TaskType.FOLLOWUP,
          dueAt,
        },
      });
      created += 1;
    }
    if (created > 0) {
      this.logger.log(`Created ${created} re-engagement tasks for WON clients`);
    }
  }
}
