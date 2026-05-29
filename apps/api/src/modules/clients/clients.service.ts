import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ActivityDirection, ActivityType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateClientInput, UpdateClientInput, ClientFilter } from '@crm/shared';
import {
  PaginatedResult,
  buildPagination,
} from '../../common/pagination';
import type { CurrentUserPayload } from '../auth/current-user.decorator';
import { canSeeOwnedResource, getAccessibleUserIds } from '../../common/rbac';
import { EmailService } from '../email/email.service';
import { TemplatesService } from '../templates/templates.service';

const CLIENT_INCLUDE = {
  source: true,
  assignedUser: { select: { id: true, fullName: true, email: true } },
  contacts: true,
  preferences: true,
} satisfies Prisma.ClientInclude;

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly templates: TemplatesService,
  ) {}

  async logCall(
    actor: CurrentUserPayload,
    clientId: string,
    input: { outcome: 'ANSWERED' | 'NO_ANSWER' | 'BUSY'; note?: string },
  ) {
    await this.getById(actor, clientId);
    const labels = {
      ANSWERED: 'Звонок состоялся',
      NO_ANSWER: 'Не ответил',
      BUSY: 'Занято',
    };
    return this.prisma.activity.create({
      data: {
        clientId,
        userId: actor.userId,
        type: ActivityType.CALL,
        direction: ActivityDirection.OUT,
        content: input.note ? `${labels[input.outcome]}. ${input.note}` : labels[input.outcome],
        metadata: { outcome: input.outcome } as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Создаёт заметку (Activity тип NOTE). Опционально прикладывает голосовое
   * сообщение через metadata.voice = { audioUrl, durationMs, mime }. URL уже
   * загружен на /uploads/audio — здесь просто сохраняем ссылку.
   */
  async addNote(
    actor: CurrentUserPayload,
    clientId: string,
    content: string,
    voice?: { audioUrl: string; durationMs: number; mime?: string },
  ) {
    await this.getById(actor, clientId);
    return this.prisma.activity.create({
      data: {
        clientId,
        userId: actor.userId,
        type: ActivityType.NOTE,
        direction: ActivityDirection.INTERNAL,
        content,
        metadata: voice ? { voice } : undefined,
      },
    });
  }

  async sendEmail(
    actor: CurrentUserPayload,
    clientId: string,
    input: { subject: string; templateId?: string; body?: string },
  ) {
    const client = await this.getById(actor, clientId);
    if (!client.email) {
      throw new BadRequestException('У клиента не указан email');
    }
    if (!this.email.isConfigured()) {
      throw new BadRequestException('SMTP не настроен — заполните переменные SMTP_* в .env');
    }

    let body = input.body ?? '';
    if (input.templateId) {
      const tpl = await this.prisma.contractTemplate.findUnique({
        where: { id: input.templateId },
      });
      if (!tpl) throw new NotFoundException('Шаблон не найден');
      body = this.templates.render(tpl.content, {
        client: {
          fullName: client.fullName,
          primaryPhone: client.primaryPhone,
          email: client.email,
        },
        agent: { email: actor.email },
      });
    }
    if (!body.trim()) {
      throw new BadRequestException('Пустое тело письма');
    }

    const ok = await this.email.send(client.email, input.subject, body);
    if (!ok) {
      throw new BadRequestException('Не удалось отправить письмо');
    }

    await this.prisma.activity.create({
      data: {
        clientId,
        userId: actor.userId,
        type: ActivityType.EMAIL,
        direction: ActivityDirection.OUT,
        content: input.subject,
        metadata: { templateId: input.templateId ?? null } as Prisma.InputJsonValue,
      },
    });
    return { sent: true };
  }

  async list(
    actor: CurrentUserPayload,
    query: ClientFilter,
  ): Promise<PaginatedResult<Prisma.ClientGetPayload<{ include: typeof CLIENT_INCLUDE }>>> {
    const where: Prisma.ClientWhereInput = {};

    if (this.isLimitedToOwn(actor.role)) {
      where.assignedUserId = actor.userId;
    }

    // Status filter: by default exclude archived/blacklisted from the «active» list.
    if (query.status === 'archived') {
      where.isArchived = true;
    } else if (query.status === 'blacklisted') {
      where.isBlacklisted = true;
    } else {
      where.isArchived = false;
      where.isBlacklisted = false;
    }

    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { primaryPhone: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        include: CLIENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...buildPagination(query),
      }),
      this.prisma.client.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async getById(actor: CurrentUserPayload, id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: CLIENT_INCLUDE,
    });
    if (!client) throw new NotFoundException('Client not found');
    this.assertCanAccess(actor, client.assignedUserId);
    return client;
  }

  async create(actor: CurrentUserPayload, input: CreateClientInput) {
    const exists = await this.prisma.client.findUnique({
      where: { primaryPhone: input.primaryPhone },
    });
    if (exists) {
      throw new ConflictException(
        `Клиент с телефоном ${input.primaryPhone} уже существует`,
      );
    }

    const assignedUserId = input.assignedUserId ?? actor.userId;
    if (this.isLimitedToOwn(actor.role) && assignedUserId !== actor.userId) {
      throw new ForbiddenException(
        'Нельзя назначать клиента другому сотруднику',
      );
    }

    return this.prisma.client.create({
      data: {
        fullName: input.fullName,
        primaryPhone: input.primaryPhone,
        email: input.email ?? null,
        avatarUrl: input.avatarUrl ?? null,
        sourceId: input.sourceId ?? null,
        assignedUserId,
        notes: input.notes,
        marketingConsent: input.marketingConsent ?? false,
        consentTimestamp: input.marketingConsent ? new Date() : null,
        consentVersion: input.marketingConsent ? '1.0' : null,
        contacts: input.contacts.length
          ? {
              create: input.contacts.map((c) => ({
                channel: c.channel,
                identifier: c.identifier,
                isPrimary: c.isPrimary,
              })),
            }
          : undefined,
        preferences: input.preferences
          ? {
              create: {
                propertyType: input.preferences.propertyType,
                dealIntent: input.preferences.dealIntent,
                currency: input.preferences.currency,
                districts: input.preferences.districts,
                roomsMin: input.preferences.roomsMin,
                roomsMax: input.preferences.roomsMax,
                priceMin: input.preferences.priceMin,
                priceMax: input.preferences.priceMax,
                areaMin: input.preferences.areaMin,
                areaMax: input.preferences.areaMax,
              },
            }
          : undefined,
      },
      include: CLIENT_INCLUDE,
    });
  }

  async update(actor: CurrentUserPayload, id: string, input: UpdateClientInput) {
    const existing = await this.prisma.client.findUnique({
      where: { id },
      select: { assignedUserId: true },
    });
    if (!existing) throw new NotFoundException('Client not found');
    this.assertCanAccess(actor, existing.assignedUserId);

    if (input.primaryPhone) {
      const dup = await this.prisma.client.findUnique({
        where: { primaryPhone: input.primaryPhone },
      });
      if (dup && dup.id !== id) {
        throw new ConflictException(
          `Клиент с телефоном ${input.primaryPhone} уже существует`,
        );
      }
    }

    return this.prisma.client.update({
      where: { id },
      data: {
        fullName: input.fullName,
        primaryPhone: input.primaryPhone,
        email: input.email,
        avatarUrl: input.avatarUrl,
        sourceId: input.sourceId,
        assignedUserId: input.assignedUserId,
        notes: input.notes,
        isArchived: input.isArchived,
        isBlacklisted: input.isBlacklisted,
        // Marketing consent — stamp timestamp + version when flipping to true,
        // clear when flipping to false (revocation).
        ...(input.marketingConsent !== undefined && {
          marketingConsent: input.marketingConsent,
          consentTimestamp: input.marketingConsent ? new Date() : null,
          consentVersion: input.marketingConsent ? '1.0' : null,
        }),
        contacts:
          input.contacts !== undefined
            ? {
                deleteMany: {},
                create: input.contacts.map((c) => ({
                  channel: c.channel,
                  identifier: c.identifier,
                  isPrimary: c.isPrimary,
                })),
              }
            : undefined,
        preferences:
          input.preferences !== undefined
            ? {
                upsert: {
                  create: {
                    propertyType: input.preferences.propertyType,
                    dealIntent: input.preferences.dealIntent,
                    currency: input.preferences.currency,
                    districts: input.preferences.districts ?? [],
                    roomsMin: input.preferences.roomsMin,
                    roomsMax: input.preferences.roomsMax,
                    priceMin: input.preferences.priceMin,
                    priceMax: input.preferences.priceMax,
                    areaMin: input.preferences.areaMin,
                    areaMax: input.preferences.areaMax,
                  },
                  update: {
                    propertyType: input.preferences.propertyType,
                    dealIntent: input.preferences.dealIntent,
                    currency: input.preferences.currency,
                    districts: input.preferences.districts,
                    roomsMin: input.preferences.roomsMin,
                    roomsMax: input.preferences.roomsMax,
                    priceMin: input.preferences.priceMin,
                    priceMax: input.preferences.priceMax,
                    areaMin: input.preferences.areaMin,
                    areaMax: input.preferences.areaMax,
                  },
                },
              }
            : undefined,
      },
      include: CLIENT_INCLUDE,
    });
  }

  async remove(actor: CurrentUserPayload, id: string) {
    const existing = await this.prisma.client.findUnique({
      where: { id },
      select: { assignedUserId: true },
    });
    if (!existing) throw new NotFoundException('Client not found');
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Только администратор может удалять клиентов');
    }
    await this.prisma.client.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Merge two client records into one. The "loser" client's leads/deals/activities/
   * tasks/showings/documents are re-pointed to the "winner", then the loser is deleted.
   * Only ADMIN/MANAGER can merge — это деструктивная операция и должна оставлять след
   * в AuditLog (он пишется ниже).
   *
   * The "winner" keeps its current profile (name/phone/email/source/preferences). If the
   * realtor wants to import losers's fields — they should patch winner explicitly before
   * calling merge. Phone collisions are impossible since `primaryPhone` is unique.
   */
  async merge(actor: CurrentUserPayload, winnerId: string, loserId: string) {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.MANAGER) {
      throw new ForbiddenException('Тільки адмін або менеджер може об\'єднувати контакти');
    }
    if (winnerId === loserId) {
      throw new BadRequestException('Неможливо об\'єднати запис із самим собою');
    }
    const [winner, loser] = await Promise.all([
      this.prisma.client.findUnique({ where: { id: winnerId }, select: { id: true, fullName: true, assignedUserId: true } }),
      this.prisma.client.findUnique({ where: { id: loserId }, select: { id: true, fullName: true, assignedUserId: true } }),
    ]);
    if (!winner) throw new NotFoundException('Winner client not found');
    if (!loser) throw new NotFoundException('Loser client not found');

    // Manager can only merge clients within their team. Admin — any.
    if (actor.role === UserRole.MANAGER) {
      const accessible = await getAccessibleUserIds(this.prisma, { id: actor.userId, role: actor.role });
      const winnerOk = canSeeOwnedResource(accessible, winner.assignedUserId);
      const loserOk = canSeeOwnedResource(accessible, loser.assignedUserId);
      if (!winnerOk || !loserOk) {
        throw new ForbiddenException('Не можна об\'єднати клієнтів іншої команди');
      }
    }

    await this.prisma.$transaction([
      this.prisma.lead.updateMany({ where: { clientId: loserId }, data: { clientId: winnerId } }),
      this.prisma.activity.updateMany({ where: { clientId: loserId }, data: { clientId: winnerId } }),
      this.prisma.task.updateMany({ where: { clientId: loserId }, data: { clientId: winnerId } }),
      this.prisma.showing.updateMany({ where: { clientId: loserId }, data: { clientId: winnerId } }),
      this.prisma.deal.updateMany({ where: { clientId: loserId }, data: { clientId: winnerId } }),
      this.prisma.document.updateMany({ where: { clientId: loserId }, data: { clientId: winnerId } }),
      this.prisma.clientContact.updateMany({ where: { clientId: loserId }, data: { clientId: winnerId } }),
      // Preferences/notes are 1:1 — drop loser's; winner's stays.
      this.prisma.clientPreferences.deleteMany({ where: { clientId: loserId } }),
      this.prisma.client.delete({ where: { id: loserId } }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        userId: actor.userId,
        entityType: 'Client',
        entityId: winnerId,
        action: 'UPDATE',
        changes: {
          action: 'merge',
          mergedFrom: loserId,
          mergedFromName: loser.fullName,
        } as Prisma.InputJsonValue,
      },
    });
    return this.getById(actor, winnerId);
  }

  private isLimitedToOwn(role: UserRole): boolean {
    return (
      role === UserRole.REALTOR ||
      role === UserRole.EMPLOYEE ||
      role === UserRole.ASSISTANT
    );
  }

  private assertCanAccess(actor: CurrentUserPayload, ownerId: string | null) {
    if (!this.isLimitedToOwn(actor.role)) return;
    if (ownerId !== actor.userId) {
      throw new ForbiddenException('Нет доступа к этому клиенту');
    }
  }
}
