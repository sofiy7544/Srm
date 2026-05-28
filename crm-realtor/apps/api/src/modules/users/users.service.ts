import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole, Locale, LeadStage } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { canActOnUser, isAdmin, isManagerOrAbove } from '../../common/rbac';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

const ACTIVE_LEAD_STAGES: LeadStage[] = [
  LeadStage.NEW,
  LeadStage.CONTACTED,
  LeadStage.QUALIFIED,
  LeadStage.SHOWING,
  LeadStage.NEGOTIATION,
];

const PUBLIC_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  locale: true,
  isActive: true,
  isAvailable: true,
  managerId: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  manager: {
    select: { id: true, fullName: true, email: true },
  },
} as const;

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: UserRole;
  managerId?: string | null;
  locale?: Locale;
}

export interface UpdateUserInput {
  fullName?: string;
  phone?: string | null;
  role?: UserRole;
  managerId?: string | null;
  locale?: Locale;
  isActive?: boolean;
  isAvailable?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Возвращает id всех подчинённых менеджера (1 уровень глубины). */
  async getManagedUserIds(managerId: string): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: { managerId, isActive: true },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Список пользователей.
   *  - ADMIN видит всех
   *  - MANAGER видит себя + своих подчинённых
   *  - EMPLOYEE/прочие — только себя
   */
  async list(actor: { id: string; role: UserRole }) {
    if (isAdmin(actor.role)) {
      return this.prisma.user.findMany({
        select: PUBLIC_SELECT,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      });
    }
    if (isManagerOrAbove(actor.role)) {
      return this.prisma.user.findMany({
        where: {
          OR: [{ id: actor.id }, { managerId: actor.id }],
        },
        select: PUBLIC_SELECT,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      });
    }
    return this.prisma.user.findMany({
      where: { id: actor.id },
      select: PUBLIC_SELECT,
    });
  }

  /** ADMIN-only: создать пользователя. */
  async create(actor: { id?: string; role: UserRole }, input: CreateUserInput) {
    if (!isAdmin(actor.role)) {
      throw new ForbiddenException('Only admins can create users');
    }
    if (input.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) throw new BadRequestException('Email already in use');

    if (input.managerId) {
      const manager = await this.prisma.user.findUnique({
        where: { id: input.managerId },
        select: { id: true, role: true },
      });
      if (!manager) throw new BadRequestException('Manager not found');
      if (!isManagerOrAbove(manager.role)) {
        throw new BadRequestException('Selected user is not a manager');
      }
    }

    const passwordHash = await argon2.hash(input.password);
    const created = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        phone: input.phone,
        role: input.role ?? UserRole.EMPLOYEE,
        managerId: input.managerId ?? null,
        locale: input.locale ?? Locale.ru,
      },
      select: PUBLIC_SELECT,
    });
    await this.audit.create(actor.id ?? null, 'User', created.id, {
      email: created.email,
      role: created.role,
    });
    return created;
  }

  /**
   * ADMIN может править любого. MANAGER — только подчинённых, и без права
   * менять роль/менеджера. Пользователь — только себя (fullName/phone/locale).
   */
  async update(
    actor: { id: string; role: UserRole },
    targetId: string,
    input: UpdateUserInput,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, managerId: true, role: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (!canActOnUser(actor, target)) {
      throw new ForbiddenException('You cannot edit this user');
    }

    const data: Prisma.UserUpdateInput = {};

    if (isAdmin(actor.role)) {
      // полный набор полей
      if (input.fullName !== undefined) data.fullName = input.fullName;
      if (input.phone !== undefined) data.phone = input.phone;
      if (input.locale !== undefined) data.locale = input.locale;
      if (input.isActive !== undefined) data.isActive = input.isActive;
      if (input.isAvailable !== undefined) data.isAvailable = input.isAvailable;
      if (input.role !== undefined) data.role = input.role;
      if (input.managerId !== undefined) {
        data.manager = input.managerId
          ? { connect: { id: input.managerId } }
          : { disconnect: true };
      }
    } else if (isManagerOrAbove(actor.role) && target.id !== actor.id) {
      // менеджер правит подчинённого — только базовые поля
      if (input.fullName !== undefined) data.fullName = input.fullName;
      if (input.phone !== undefined) data.phone = input.phone;
      if (input.locale !== undefined) data.locale = input.locale;
      if (input.isActive !== undefined) data.isActive = input.isActive;
      if (input.isAvailable !== undefined) data.isAvailable = input.isAvailable;
      if (input.role !== undefined || input.managerId !== undefined) {
        throw new ForbiddenException(
          'Only admins can change role or manager assignment',
        );
      }
    } else {
      // сам себя — профильные поля + own availability (отпуск)
      if (input.fullName !== undefined) data.fullName = input.fullName;
      if (input.phone !== undefined) data.phone = input.phone;
      if (input.locale !== undefined) data.locale = input.locale;
      if (input.isAvailable !== undefined) data.isAvailable = input.isAvailable;
      if (
        input.role !== undefined ||
        input.managerId !== undefined ||
        input.isActive !== undefined
      ) {
        throw new ForbiddenException('You cannot change role / manager / status');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data,
      select: PUBLIC_SELECT,
    });
    await this.audit.update(actor.id, 'User', targetId, {
      changedFields: Object.keys(data),
    });
    return updated;
  }

  /** Деактивация (мягкое удаление). ADMIN-only.
   *  Возвращает все активные лиды деактивированного агента обратно в пул
   *  (assignedUserId=null), чтобы коллеги могли их подхватить. Без этого
   *  15 активных лидов уволенного агента остаются на нём и теряются.
   */
  async deactivate(actor: { role: UserRole; id: string }, targetId: string) {
    if (!isAdmin(actor.role)) throw new ForbiddenException('Admin only');
    if (actor.id === targetId) {
      throw new BadRequestException('You cannot deactivate yourself');
    }

    // 1. Find the agent's active leads BEFORE deactivating, so we can notify.
    const activeLeads = await this.prisma.lead.findMany({
      where: { assignedUserId: targetId, stage: { in: ACTIVE_LEAD_STAGES } },
      select: {
        id: true,
        client: { select: { fullName: true } },
      },
    });

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetId },
        data: { isActive: false },
        select: PUBLIC_SELECT,
      }),
      // Move all active leads to the pool — coworkers can claim them.
      this.prisma.lead.updateMany({
        where: { assignedUserId: targetId, stage: { in: ACTIVE_LEAD_STAGES } },
        data: { assignedUserId: null },
      }),
      // Revoke all active refresh tokens — can't log in anymore.
      this.prisma.refreshToken.updateMany({
        where: { userId: targetId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    // 2. Notify all admins/managers about the bulk return to pool.
    if (activeLeads.length > 0) {
      const supervisors = await this.prisma.user.findMany({
        where: {
          isActive: true,
          role: { in: [UserRole.ADMIN, UserRole.MANAGER] },
          id: { not: actor.id }, // don't notify the actor (they just did it)
        },
        select: { id: true },
      });
      for (const sup of supervisors) {
        await this.notifications.notify({
          userId: sup.id,
          type: 'LEAD_LOST_REOPEN',
          title: 'Деактивован агент — лиды в пуле',
          body: `${activeLeads.length} активных лидов вернулись в /pool. Распределите между свободными агентами.`,
          link: '/pool',
        }).catch(() => undefined);
      }
    }

    await this.audit.update(actor.id, 'User', targetId, {
      isActive: false,
      reason: 'deactivated',
      leadsReleased: activeLeads.length,
    });
    return updated;
  }

  /** Активация. ADMIN-only. */
  async activate(actor: { role: UserRole; id: string }, targetId: string) {
    if (!isAdmin(actor.role)) throw new ForbiddenException('Admin only');
    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { isActive: true },
      select: PUBLIC_SELECT,
    });
    await this.audit.update(actor.id, 'User', targetId, { isActive: true, reason: 'activated' });
    return updated;
  }

  /**
   * Сброс пароля. ADMIN может задать конкретный пароль или сгенерировать
   * случайный (вернётся в ответе один раз). Пользователь может сменить себе
   * пароль, передав oldPassword.
   */
  async resetPassword(
    actor: { id: string; role: UserRole },
    targetId: string,
    options: { newPassword?: string; oldPassword?: string },
  ): Promise<{ password?: string }> {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, managerId: true, passwordHash: true },
    });
    if (!target) throw new NotFoundException('User not found');

    if (!isAdmin(actor.role)) {
      if (actor.id !== targetId) {
        throw new ForbiddenException('Only admins can reset others');
      }
      if (!options.oldPassword) {
        throw new BadRequestException('Old password required');
      }
      const ok = await argon2.verify(target.passwordHash, options.oldPassword);
      if (!ok) throw new BadRequestException('Old password is incorrect');
    }

    const newPwd =
      options.newPassword && options.newPassword.length >= 8
        ? options.newPassword
        : randomBytes(8).toString('base64url').slice(0, 12);

    const passwordHash = await argon2.hash(newPwd);
    await this.prisma.user.update({
      where: { id: targetId },
      data: { passwordHash },
    });
    // Отозвём все refresh-токены — пользователю придётся залогиниться заново.
    await this.prisma.refreshToken.updateMany({
      where: { userId: targetId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.update(actor.id, 'User', targetId, {
      reason: 'password-reset',
      byAdmin: isAdmin(actor.role),
    });

    // Если ADMIN не передал пароль явно — отдадим сгенерированный, иначе
    // вернём пустой объект, чтобы лишний раз не светить пароль в логах.
    if (isAdmin(actor.role) && !options.newPassword) {
      return { password: newPwd };
    }
    return {};
  }

  /** Активность пользователя — для admin panel. ADMIN или сам пользователь. */
  async activity(actor: { id: string; role: UserRole }, targetId: string) {
    if (!isAdmin(actor.role) && actor.id !== targetId) {
      const target = await this.prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true, managerId: true },
      });
      if (!target) throw new NotFoundException('User not found');
      if (!canActOnUser(actor, target)) throw new ForbiddenException();
    }
    const [deals, tasks, leads] = await Promise.all([
      this.prisma.deal.count({ where: { agentId: targetId } }),
      this.prisma.task.count({ where: { userId: targetId } }),
      this.prisma.lead.count({ where: { assignedUserId: targetId } }),
    ]);
    const recentTasks = await this.prisma.task.findMany({
      where: { userId: targetId },
      take: 10,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        dueAt: true,
        completedAt: true,
        updatedAt: true,
      },
    });
    return { counts: { deals, tasks, leads }, recentTasks };
  }
}
