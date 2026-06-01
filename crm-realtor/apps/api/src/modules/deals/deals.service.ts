import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DealStatus, PropertyStatus, Prisma, UserRole, LeadStage } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type {
  CreateDealInput,
  UpdateDealInput,
  DealFilter,
} from '@crm/shared';
import type { CurrentUserPayload } from '../auth/current-user.decorator';

const DEAL_INCLUDE = {
  lead: { select: { id: true, stage: true } },
  client: { select: { id: true, fullName: true, primaryPhone: true } },
  property: { select: { id: true, address: true, district: true } },
  agent: { select: { id: true, fullName: true, email: true } },
  payments: true,
} satisfies Prisma.DealInclude;

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: CurrentUserPayload, filter: DealFilter) {
    const where: Prisma.DealWhereInput = {};
    if (this.isLimitedToOwn(actor.role)) where.agentId = actor.userId;
    else if (filter.agentId) where.agentId = filter.agentId;
    if (filter.status) where.status = filter.status;
    if (filter.from || filter.to) {
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = new Date(filter.from);
      if (filter.to) where.createdAt.lte = new Date(filter.to);
    }

    const skip = (filter.page - 1) * filter.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.deal.findMany({
        where,
        include: DEAL_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filter.pageSize,
      }),
      this.prisma.deal.count({ where }),
    ]);
    return { items, total, page: filter.page, pageSize: filter.pageSize };
  }

  async getById(actor: CurrentUserPayload, id: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id }, include: DEAL_INCLUDE });
    if (!deal) throw new NotFoundException('Deal not found');
    if (this.isLimitedToOwn(actor.role) && deal.agentId !== actor.userId) {
      throw new ForbiddenException('Нет доступа к этой сделке');
    }
    return deal;
  }

  async create(actor: CurrentUserPayload, input: CreateDealInput) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: input.leadId },
      include: { client: true, interestProperty: true, deal: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.deal) throw new BadRequestException('По этому лиду уже создана сделка');

    const propertyId = input.propertyId ?? lead.interestPropertyId;
    if (!propertyId) {
      throw new BadRequestException('Не указан объект сделки');
    }

    const agentId = input.agentId ?? lead.assignedUserId ?? actor.userId;
    const commissionAmount =
      Math.round((input.amount * input.commissionPercent) / 100 * 100) / 100;

    let deal;
    try {
      deal = await this.prisma.deal.create({
        data: {
          leadId: input.leadId,
          clientId: lead.clientId,
          propertyId,
          agentId,
          dealIntent: lead.dealIntent,
          amount: input.amount,
          commissionPercent: input.commissionPercent,
          commissionAmount,
          status: DealStatus.IN_PROGRESS,
        },
        include: DEAL_INCLUDE,
      });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('По этому лиду уже создана сделка');
      }
      throw e;
    }

    await this.prisma.lead.update({
      where: { id: lead.id },
      data: { stage: LeadStage.NEGOTIATION, stageChangedAt: new Date() },
    });
    await this.prisma.property.update({
      where: { id: propertyId },
      data: { status: PropertyStatus.RESERVED },
    });
    await this.audit.create(actor.userId, 'Deal', deal.id, {
      amount: Number(deal.amount),
      leadId: deal.leadId,
      propertyId: deal.propertyId,
    });
    return deal;
  }

  async update(actor: CurrentUserPayload, id: string, input: UpdateDealInput) {
    const deal = await this.getById(actor, id);

    const amount = input.amount ?? Number(deal.amount);
    const percent = input.commissionPercent ?? Number(deal.commissionPercent);
    const commissionAmount = Math.round((amount * percent) / 100 * 100) / 100;

    const wasOpen = deal.status === DealStatus.IN_PROGRESS;
    const becomesCompleted = input.status === DealStatus.COMPLETED;
    const becomesCancelled = input.status === DealStatus.CANCELLED;

    const updated = await this.prisma.deal.update({
      where: { id },
      data: {
        amount: input.amount,
        commissionPercent: input.commissionPercent,
        commissionAmount: input.amount !== undefined || input.commissionPercent !== undefined ? commissionAmount : undefined,
        status: input.status,
        closedAt:
          input.closedAt === null
            ? null
            : input.closedAt
              ? new Date(input.closedAt)
              : becomesCompleted || becomesCancelled
                ? new Date()
                : undefined,
      },
      include: DEAL_INCLUDE,
    });

    if (wasOpen && becomesCompleted) {
      await this.prisma.property.update({
        where: { id: deal.propertyId },
        data: { status: PropertyStatus.SOLD },
      });
      await this.prisma.lead.update({
        where: { id: deal.leadId },
        data: { stage: LeadStage.WON, stageChangedAt: new Date() },
      });
    } else if (wasOpen && becomesCancelled) {
      await this.prisma.property.update({
        where: { id: deal.propertyId },
        data: { status: PropertyStatus.AVAILABLE },
      });
      await this.prisma.lead.update({
        where: { id: deal.leadId },
        data: { stage: LeadStage.LOST, stageChangedAt: new Date() },
      });
    }

    await this.audit.update(actor.userId, 'Deal', id, {
      changedFields: Object.keys(input),
      newStatus: input.status ?? null,
    } as Prisma.InputJsonValue);

    return updated;
  }

  async remove(actor: CurrentUserPayload, id: string) {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Только администратор может удалять сделки');
    }
    await this.getById(actor, id);
    await this.prisma.deal.delete({ where: { id } });
    await this.audit.delete(actor.userId, 'Deal', id);
    return { ok: true };
  }

  private isLimitedToOwn(role: UserRole): boolean {
    return (
      role === UserRole.REALTOR ||
      role === UserRole.EMPLOYEE ||
      role === UserRole.ASSISTANT
    );
  }
}
