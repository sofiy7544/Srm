import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import {
  ActivityDirection,
  ActivityType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateShowingInput,
  UpdateShowingInput,
  ShowingFilter,
} from '@crm/shared';
import type { CurrentUserPayload } from '../auth/current-user.decorator';

const SHOWING_INCLUDE = {
  property: { select: { id: true, address: true, district: true } },
  client: { select: { id: true, fullName: true, primaryPhone: true } },
  agent: { select: { id: true, fullName: true } },
} satisfies Prisma.ShowingInclude;

@Injectable()
export class ShowingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: CurrentUserPayload, filter: ShowingFilter) {
    const where: Prisma.ShowingWhereInput = {};
    if (this.isLimitedToOwn(actor.role)) {
      where.agentId = actor.userId;
    } else if (filter.agentId) {
      where.agentId = filter.agentId;
    }
    if (filter.propertyId) where.propertyId = filter.propertyId;
    if (filter.clientId) where.clientId = filter.clientId;
    if (filter.status) where.status = filter.status;
    if (filter.from || filter.to) {
      where.scheduledAt = {};
      if (filter.from) where.scheduledAt.gte = new Date(filter.from);
      if (filter.to) where.scheduledAt.lte = new Date(filter.to);
    }
    return this.prisma.showing.findMany({
      where,
      include: SHOWING_INCLUDE,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async create(actor: CurrentUserPayload, input: CreateShowingInput) {
    const agentId = input.agentId ?? actor.userId;
    if (this.isLimitedToOwn(actor.role) && agentId !== actor.userId) {
      throw new ForbiddenException('Нельзя назначать показ другому риелтору');
    }
    const client = await this.prisma.client.findUnique({
      where: { id: input.clientId },
      select: { isBlacklisted: true, isArchived: true, fullName: true },
    });
    if (!client) throw new NotFoundException('Client not found');
    if (client.isBlacklisted) {
      throw new BadRequestException(`Контакт «${client.fullName}» у чорному списку`);
    }
    if (client.isArchived) {
      throw new BadRequestException(`Контакт «${client.fullName}» у архіві`);
    }
    const showing = await this.prisma.showing.create({
      data: {
        propertyId: input.propertyId,
        clientId: input.clientId,
        agentId,
        scheduledAt: new Date(input.scheduledAt),
        durationMin: input.durationMin,
      },
      include: SHOWING_INCLUDE,
    });
    await this.prisma.activity.create({
      data: {
        clientId: showing.clientId,
        userId: actor.userId,
        type: ActivityType.SHOWING,
        direction: ActivityDirection.INTERNAL,
        content: `Запланирован показ: ${showing.property.address}`,
        metadata: { showingId: showing.id, scheduledAt: showing.scheduledAt } as Prisma.InputJsonValue,
      },
    });
    return showing;
  }

  async update(actor: CurrentUserPayload, id: string, input: UpdateShowingInput) {
    const existing = await this.prisma.showing.findUnique({
      where: { id },
      select: { agentId: true, status: true, clientId: true, propertyId: true },
    });
    if (!existing) throw new NotFoundException('Showing not found');
    if (this.isLimitedToOwn(actor.role) && existing.agentId !== actor.userId) {
      throw new ForbiddenException('Нет доступа к этому показу');
    }

    const updated = await this.prisma.showing.update({
      where: { id },
      data: {
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        durationMin: input.durationMin,
        status: input.status,
        feedback: input.feedback,
        agentId: input.agentId,
      },
      include: SHOWING_INCLUDE,
    });

    // Post-showing feedback prompt: when a showing transitions to COMPLETED and the
    // agent hasn't already left feedback, create a follow-up task. Real-estate killer
    // feature — feedback collection within 24h is when impressions are sharpest.
    const justCompleted =
      input.status === 'COMPLETED' && existing.status !== 'COMPLETED' && !input.feedback;
    if (justCompleted) {
      const dueAt = new Date();
      dueAt.setHours(dueAt.getHours() + 2); // 2 hours after the showing's update
      await this.prisma.task.create({
        data: {
          userId: existing.agentId,
          clientId: existing.clientId,
          title: `Зафіксувати враження з показу: ${updated.property.address}`,
          description: `Що сподобалось, що ні, які питання, наступний крок?`,
          type: 'FOLLOWUP',
          dueAt,
        },
      });
    }

    return updated;
  }

  async remove(actor: CurrentUserPayload, id: string) {
    const existing = await this.prisma.showing.findUnique({
      where: { id },
      select: { agentId: true },
    });
    if (!existing) throw new NotFoundException('Showing not found');
    if (this.isLimitedToOwn(actor.role) && existing.agentId !== actor.userId) {
      throw new ForbiddenException('Нет доступа к этому показу');
    }
    await this.prisma.showing.delete({ where: { id } });
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
