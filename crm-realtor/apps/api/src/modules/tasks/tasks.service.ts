import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, TaskStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateTaskInput, UpdateTaskInput, TaskFilter } from '@crm/shared';
import type { CurrentUserPayload } from '../auth/current-user.decorator';

const TASK_INCLUDE = {
  user: { select: { id: true, fullName: true } },
  client: { select: { id: true, fullName: true } },
  lead: { select: { id: true, stage: true } },
} satisfies Prisma.TaskInclude;

const TYPE_LABEL_UK: Record<string, string> = {
  CALL: 'Дзвінок',
  SHOWING: 'Показ',
  FOLLOWUP: 'Слідкування',
  CUSTOM: 'Задача',
};

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(actor: CurrentUserPayload, filter: TaskFilter) {
    const where: Prisma.TaskWhereInput = {};
    // Limited roles cannot peek into other agents' tasks via ?userId=…
    if (this.isLimitedToOwn(actor.role) && filter.userId && filter.userId !== actor.userId) {
      throw new ForbiddenException('Нельзя смотреть задачи другого сотрудника');
    }
    if (this.isLimitedToOwn(actor.role) || !filter.userId) {
      where.userId = filter.userId ?? actor.userId;
    } else {
      where.userId = filter.userId;
    }
    if (filter.status) where.status = filter.status;
    if (filter.clientId) where.clientId = filter.clientId;
    if (filter.leadId) where.leadId = filter.leadId;
    if (filter.dueFrom || filter.dueTo) {
      where.dueAt = {};
      if (filter.dueFrom) where.dueAt.gte = new Date(filter.dueFrom);
      if (filter.dueTo) where.dueAt.lte = new Date(filter.dueTo);
    }

    const skip = (filter.page - 1) * filter.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: TASK_INCLUDE,
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
        skip,
        take: filter.pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);
    return { items, total, page: filter.page, pageSize: filter.pageSize };
  }

  async create(actor: CurrentUserPayload, input: CreateTaskInput) {
    const userId = input.userId ?? actor.userId;
    if (this.isLimitedToOwn(actor.role) && userId !== actor.userId) {
      throw new ForbiddenException('Нельзя назначать задачу другому сотруднику');
    }
    const task = await this.prisma.task.create({
      data: {
        userId,
        clientId: input.clientId ?? null,
        leadId: input.leadId ?? null,
        title: input.title,
        description: input.description,
        type: input.type,
        dueAt: new Date(input.dueAt),
      },
      include: TASK_INCLUDE,
    });
    if (userId !== actor.userId) {
      const dueStr = task.dueAt.toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
      const typeLabel = TYPE_LABEL_UK[task.type] ?? 'Задача';
      this.notifications
        .notify({
          userId,
          type: 'NEW_TASK',
          title: `Нова задача: ${typeLabel}`,
          body: `${task.title} · до ${dueStr}`,
          link: `/tasks`,
        })
        .catch((e) => this.logger.error(`Failed to notify assignee: ${(e as Error).message}`));
    }
    return task;
  }

  async update(actor: CurrentUserPayload, id: string, input: UpdateTaskInput) {
    const existing = await this.prisma.task.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing) throw new NotFoundException('Task not found');
    this.assertCanAccess(actor, existing.userId);

    // Limited roles cannot reassign their tasks to other agents on update.
    if (
      this.isLimitedToOwn(actor.role) &&
      input.userId &&
      input.userId !== actor.userId
    ) {
      throw new ForbiddenException('Нельзя переназначить задачу другому сотруднику');
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        type: input.type,
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        status: input.status,
        completedAt:
          input.status === TaskStatus.DONE ? new Date() : input.status ? null : undefined,
        userId: input.userId,
      },
      include: TASK_INCLUDE,
    });
    if (input.userId && input.userId !== existing.userId && input.userId !== actor.userId) {
      const dueStr = updated.dueAt.toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
      const typeLabel = TYPE_LABEL_UK[updated.type] ?? 'Задача';
      this.notifications
        .notify({
          userId: input.userId,
          type: 'NEW_TASK',
          title: `Задачу переназначено: ${typeLabel}`,
          body: `${updated.title} · до ${dueStr}`,
          link: `/tasks`,
        })
        .catch((e) => this.logger.error(`Failed to notify reassignee: ${(e as Error).message}`));
    }
    return updated;
  }

  async complete(actor: CurrentUserPayload, id: string) {
    return this.update(actor, id, { status: TaskStatus.DONE });
  }

  async remove(actor: CurrentUserPayload, id: string) {
    const existing = await this.prisma.task.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing) throw new NotFoundException('Task not found');
    this.assertCanAccess(actor, existing.userId);
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }

  async markOverdue() {
    const now = new Date();
    const { count } = await this.prisma.task.updateMany({
      where: { status: TaskStatus.PENDING, dueAt: { lt: now } },
      data: { status: TaskStatus.OVERDUE },
    });
    return { updated: count };
  }

  private isLimitedToOwn(role: UserRole): boolean {
    return (
      role === UserRole.REALTOR ||
      role === UserRole.EMPLOYEE ||
      role === UserRole.ASSISTANT
    );
  }

  private assertCanAccess(actor: CurrentUserPayload, ownerId: string) {
    if (this.isLimitedToOwn(actor.role) && ownerId !== actor.userId) {
      throw new ForbiddenException('Нет доступа к этой задаче');
    }
  }
}
