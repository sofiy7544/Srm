import {
  BadRequestException, ForbiddenException, Injectable,
  Logger, NotFoundException,
} from '@nestjs/common';
import { ActivityDirection, ActivityType, LeadStage, Prisma, PropertyStatus, UserRole } from '@prisma/client';

const ACTIVE_LEAD_STAGES: LeadStage[] = [
  LeadStage.NEW,
  LeadStage.CONTACTED,
  LeadStage.QUALIFIED,
  LeadStage.SHOWING,
  LeadStage.NEGOTIATION,
];
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateLeadInput, UpdateLeadInput, UpdateLeadStageInput, BulkReassignInput } from '@crm/shared';
import type { CurrentUserPayload } from '../auth/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { AutomationService } from '../automation/automation.service';

const LEAD_INCLUDE = {
  client: { select: { id: true, fullName: true, primaryPhone: true } },
  source: true,
  assignedUser: { select: { id: true, fullName: true, email: true } },
  interestProperty: { select: { id: true, address: true, district: true, price: true, currency: true, status: true } },
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly automation: AutomationService,
  ) {}

  async list(actor: CurrentUserPayload) {
    const where: Prisma.LeadWhereInput = {};
    if (this.isLimitedToOwn(actor.role)) where.assignedUserId = actor.userId;
    return this.prisma.lead.findMany({
      where, include: LEAD_INCLUDE,
      orderBy: [{ stageChangedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getById(actor: CurrentUserPayload, id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id }, include: LEAD_INCLUDE });
    if (!lead) throw new NotFoundException('Lead not found');
    this.assertCanAccess(actor, lead.assignedUserId);
    return lead;
  }

  async create(actor: CurrentUserPayload, input: CreateLeadInput) {
    const client = await this.prisma.client.findUnique({
      where: { id: input.clientId },
      select: { id: true, assignedUserId: true, isBlacklisted: true, isArchived: true, fullName: true },
    });
    if (!client) throw new NotFoundException('Client not found');
    if (client.isBlacklisted) {
      throw new BadRequestException(
        `Контакт «${client.fullName}» у чорному списку. Спочатку розблокуйте на картці контакта.`,
      );
    }
    if (client.isArchived) {
      throw new BadRequestException(
        `Контакт «${client.fullName}» у архіві. Спочатку поверніть з архіву на картці контакта.`,
      );
    }
    // Race-safe dup check: prevent two tabs from both creating an active lead for the same client.
    const activeDup = await this.prisma.lead.findFirst({
      where: { clientId: input.clientId, stage: { in: ACTIVE_LEAD_STAGES } },
      select: { id: true, stage: true },
    });
    if (activeDup) {
      throw new BadRequestException(
        `У цього контакта вже є активний лід у стадії ${activeDup.stage}. ID: ${activeDup.id}`,
      );
    }
    const assignedUserId = (input.assignedUserId ?? client.assignedUserId) ?? actor.userId;
    if (input.interestPropertyId && input.interestNote) {
      throw new BadRequestException(
        'Specify either interestPropertyId or interestNote, not both',
      );
    }
    if (input.interestPropertyId) {
      const prop = await this.prisma.property.findUnique({
        where: { id: input.interestPropertyId },
        select: { dealIntent: true },
      });
      if (prop && prop.dealIntent !== input.dealIntent) {
        throw new BadRequestException(
          `Lead intent (${input.dealIntent}) does not match property intent (${prop.dealIntent})`,
        );
      }
    }
    const lead = await this.prisma.lead.create({
      data: {
        clientId: input.clientId,
        sourceId: input.sourceId,
        assignedUserId,
        stage: input.stage,
        dealIntent: input.dealIntent,
        interestPropertyId: input.interestPropertyId ?? null,
        interestNote: input.interestNote?.trim() || null,
        interestPhotoUrl: input.interestPhotoUrl ?? null,
        priority: input.priority ?? 'warm',
      },
      include: LEAD_INCLUDE,
    });
    if (assignedUserId) {
      await this.logActivity(lead.clientId, lead.id, actor.userId, ActivityType.ASSIGNMENT, { assignedUserId, action: 'created' });
      if (assignedUserId !== actor.userId) {
        await this.notifications.notify({ userId: assignedUserId, type: 'NEW_LEAD', title: 'New lead assigned', body: lead.client.fullName, link: `/leads/${lead.id}` });
      }
    }
    if (!input.assignedUserId) {
      setImmediate(() => {
        this.automation.runOnLeadCreate(lead.id).catch((e) => this.logger.error(`Automation failed: ${(e as Error).message}`));
      });
    }
    return lead;
  }

  async update(actor: CurrentUserPayload, id: string, input: UpdateLeadInput) {
    const lead = await this.getById(actor, id);
    if (input.assignedUserId !== undefined && input.assignedUserId !== lead.assignedUserId) {
      if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.MANAGER) {
        throw new ForbiddenException('Only admin or manager can reassign leads');
      }
    }
    if (input.interestPropertyId && input.interestNote) {
      throw new BadRequestException(
        'Specify either interestPropertyId or interestNote, not both',
      );
    }
    if (input.interestPropertyId) {
      const prop = await this.prisma.property.findUnique({
        where: { id: input.interestPropertyId },
        select: { dealIntent: true },
      });
      const targetIntent = input.dealIntent ?? lead.dealIntent;
      if (prop && prop.dealIntent !== targetIntent) {
        throw new BadRequestException(
          `Lead intent (${targetIntent}) does not match property intent (${prop.dealIntent})`,
        );
      }
    }
    // Mutex: when user picks a CRM property, clear the free-text note; and vice versa.
    let interestPropertyId = input.interestPropertyId;
    let interestNote: string | null | undefined = input.interestNote === undefined
      ? undefined
      : (input.interestNote?.trim() || null);
    if (interestPropertyId) interestNote = null;
    if (interestNote) interestPropertyId = null;
    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        assignedUserId: input.assignedUserId,
        sourceId: input.sourceId,
        dealIntent: input.dealIntent,
        priority: input.priority,
        interestPropertyId,
        interestNote,
        interestPhotoUrl: input.interestPhotoUrl === undefined ? undefined : input.interestPhotoUrl,
      },
      include: LEAD_INCLUDE,
    });
    if (input.assignedUserId !== undefined && input.assignedUserId !== lead.assignedUserId) {
      await this.logActivity(updated.clientId, updated.id, actor.userId, ActivityType.ASSIGNMENT, { from: lead.assignedUserId, to: input.assignedUserId });
      if (input.assignedUserId && input.assignedUserId !== actor.userId) {
        await this.notifications.notify({ userId: input.assignedUserId, type: 'NEW_LEAD', title: 'Lead assigned to you', body: updated.client.fullName, link: `/leads/${updated.id}` });
      }
    }
    return updated;
  }

  async changeStage(actor: CurrentUserPayload, id: string, input: UpdateLeadStageInput) {
    const lead = await this.getById(actor, id);
    if (lead.stage === input.stage) return lead;
    const now = new Date();

    // Property real-time hold:
    // — entering NEGOTIATION → property goes RESERVED (so other realtors can't pull it)
    // — leaving NEGOTIATION without WON → property comes back to AVAILABLE
    // — WON path is owned by deals.service which sets RESERVED
    const propertyId = lead.interestPropertyId;
    const enteringNegotiation = input.stage === LeadStage.NEGOTIATION && lead.stage !== LeadStage.NEGOTIATION;
    const leavingNegotiation =
      lead.stage === LeadStage.NEGOTIATION &&
      input.stage !== LeadStage.NEGOTIATION &&
      input.stage !== LeadStage.WON;

    const [updated] = await this.prisma.$transaction([
      this.prisma.lead.update({
        where: { id },
        data: {
          stage: input.stage,
          lostReason: input.stage === LeadStage.LOST ? input.lostReason : null,
          lostAt: input.stage === LeadStage.LOST ? now : null,
          stageChangedAt: now,
          lastActivityAt: now,
        },
        include: LEAD_INCLUDE,
      }),
      ...(propertyId && enteringNegotiation
        ? [this.prisma.property.update({
            where: { id: propertyId },
            data: { status: PropertyStatus.RESERVED },
          })]
        : []),
      ...(propertyId && leavingNegotiation
        ? [this.prisma.property.update({
            where: { id: propertyId },
            data: { status: PropertyStatus.AVAILABLE },
          })]
        : []),
    ]);

    await this.logActivity(updated.clientId, updated.id, actor.userId, ActivityType.STAGE_CHANGE, { from: lead.stage, to: input.stage, lostReason: input.lostReason ?? null });
    return updated;
  }

  /**
   * Claim a lead. Used by the "pond" pattern: leads created without an assignee
   * (no round-robin rule matched) or re-pooled by SLA-breach escalation are
   * visible to all realtors; first to click "Взяти в роботу" gets it.
   *
   * Race-safe via an atomic update guarded by `assignedUserId: null`.
   */
  /** Unassigned leads (the "pond") — visible to all realtors for first-claim. */
  async listPool(_actor: CurrentUserPayload) {
    return this.prisma.lead.findMany({
      where: {
        assignedUserId: null,
        stage: { notIn: [LeadStage.WON, LeadStage.LOST] },
      },
      include: LEAD_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async claim(actor: CurrentUserPayload, id: string) {
    const updated = await this.prisma.lead.updateMany({
      where: { id, assignedUserId: null },
      data: { assignedUserId: actor.userId, lastActivityAt: new Date() },
    });
    if (updated.count === 0) {
      const existing = await this.prisma.lead.findUnique({
        where: { id },
        select: { assignedUserId: true },
      });
      throw new BadRequestException(
        existing?.assignedUserId
          ? 'Лід вже взяв у роботу інший агент'
          : 'Лід не знайдено',
      );
    }
    await this.prisma.activity.create({
      data: {
        clientId: (await this.prisma.lead.findUnique({ where: { id }, select: { clientId: true } }))!.clientId,
        leadId: id,
        userId: actor.userId,
        type: ActivityType.ASSIGNMENT,
        direction: ActivityDirection.INTERNAL,
        content: 'Самопризначення з пулу',
        metadata: { claimed: true, to: actor.userId } as Prisma.InputJsonValue,
      },
    });
    return this.getById(actor, id);
  }

  /** Bump `lastActivityAt` when a real touch happens (call/message/note/showing). */
  async touchActivity(leadId: string) {
    await this.prisma.lead
      .update({ where: { id: leadId }, data: { lastActivityAt: new Date() } })
      .catch(() => undefined); // lead may have been deleted
  }

  async bulkReassign(actor: CurrentUserPayload, input: BulkReassignInput) {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.MANAGER) {
      throw new ForbiddenException('Only admin or manager can reassign leads');
    }
    const assignee = await this.prisma.user.findUnique({ where: { id: input.assignedUserId }, select: { id: true, isActive: true } });
    if (!assignee?.isActive) throw new NotFoundException('Assignee user not found');
    const leads = await this.prisma.lead.findMany({ where: { id: { in: input.leadIds } }, select: { id: true, clientId: true, assignedUserId: true } });
    if (leads.length !== input.leadIds.length) {
      const missing = input.leadIds.filter((id) => !new Set(leads.map((l) => l.id)).has(id));
      throw new BadRequestException(`Leads not found: ${missing.slice(0, 5).join(', ')}`);
    }
    await this.prisma.lead.updateMany({ where: { id: { in: input.leadIds } }, data: { assignedUserId: input.assignedUserId } });
    if (leads.length) {
      await this.prisma.activity.createMany({
        data: leads.map((l) => ({
          clientId: l.clientId, leadId: l.id, userId: actor.userId,
          type: ActivityType.ASSIGNMENT, direction: ActivityDirection.INTERNAL,
          metadata: { from: l.assignedUserId, to: input.assignedUserId, bulk: true } as Prisma.InputJsonValue,
        })),
      });
      if (input.assignedUserId !== actor.userId) {
        await this.notifications.notify({ userId: input.assignedUserId, type: 'NEW_LEAD', title: `${leads.length} leads assigned to you`, body: 'Go to Leads', link: '/leads' });
      }
    }
    return { reassigned: leads.length };
  }

  async remove(actor: CurrentUserPayload, id: string) {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.MANAGER) {
      throw new ForbiddenException('Only admin or manager can delete leads');
    }
    await this.getById(actor, id);
    await this.prisma.lead.delete({ where: { id } });
    return { ok: true };
  }

  async stats(actor: CurrentUserPayload) {
    const where: Prisma.LeadWhereInput = {};
    if (this.isLimitedToOwn(actor.role)) where.assignedUserId = actor.userId;
    const grouped = await this.prisma.lead.groupBy({ by: ['stage'], _count: { _all: true }, where });
    const result: Record<string, number> = {};
    for (const g of grouped) result[g.stage] = g._count._all;
    return result;
  }

  private async logActivity(clientId: string, leadId: string, userId: string, type: ActivityType, metadata: Record<string, unknown>) {
    const contentMap: Partial<Record<ActivityType, (m: Record<string, unknown>) => string>> = {
      [ActivityType.STAGE_CHANGE]: (m) => `Stage: ${m.from} to ${m.to}${m.lostReason ? ` (${m.lostReason})` : ''}`,
      [ActivityType.ASSIGNMENT]: (m) => m.bulk ? `Bulk reassign` : `Assigned: ${m.action === 'created' ? 'lead created' : `${m.from ?? '-'} to ${m.to ?? '-'}`}`,
    };
    await this.prisma.activity.create({
      data: { clientId, leadId, userId, type, direction: ActivityDirection.INTERNAL, content: contentMap[type]?.(metadata) ?? null, metadata: metadata as Prisma.InputJsonValue },
    });
  }

  private isLimitedToOwn(role: UserRole): boolean {
    return role === UserRole.REALTOR || role === UserRole.EMPLOYEE || role === UserRole.ASSISTANT;
  }

  private assertCanAccess(actor: CurrentUserPayload, ownerId: string | null) {
    if (!this.isLimitedToOwn(actor.role)) return;
    if (ownerId !== actor.userId) throw new ForbiddenException('Access denied');
  }
}
