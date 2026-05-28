import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Централизованный аудит-логгер.
 *
 * Все CUD-операции над чувствительными сущностями (users, deals, payments,
 * properties, etc.) должны проходить через этот сервис. Записи попадают
 * в таблицу `audit_log` и доступны для compliance / security review.
 *
 * Дизайн: запись делается best-effort — если БД недоступна, ошибка
 * логируется, но НЕ блокирует основную операцию. Это сознательное
 * решение: audit-failure не должен ломать бизнес-логику.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Записать событие в audit_log.
   *
   * @param userId   id актёра (null для системных событий)
   * @param entityType строковый идентификатор сущности: 'User', 'Deal', 'Property', ...
   * @param entityId id затронутого ресурса
   * @param action   CREATE / UPDATE / DELETE
   * @param changes  diff либо метаданные (jsonb). Опционально.
   */
  async log(
    userId: string | null,
    entityType: string,
    entityId: string,
    action: AuditAction,
    changes?: Prisma.InputJsonValue,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          entityType,
          entityId,
          action,
          changes: changes ?? undefined,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit log [${entityType}#${entityId} ${action} by ${userId ?? 'system'}]: ${
          (err as Error).message
        }`,
      );
    }
  }

  /** Удобный helper для CREATE. */
  create(userId: string | null, entityType: string, entityId: string, changes?: Prisma.InputJsonValue) {
    return this.log(userId, entityType, entityId, AuditAction.CREATE, changes);
  }

  /** Удобный helper для UPDATE. */
  update(userId: string | null, entityType: string, entityId: string, changes?: Prisma.InputJsonValue) {
    return this.log(userId, entityType, entityId, AuditAction.UPDATE, changes);
  }

  /** Удобный helper для DELETE. */
  delete(userId: string | null, entityType: string, entityId: string, changes?: Prisma.InputJsonValue) {
    return this.log(userId, entityType, entityId, AuditAction.DELETE, changes);
  }

  /**
   * Список событий по сущности — для UI activity-timeline.
   * Сортировка по убыванию даты.
   */
  list(entityType: string, entityId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
  }
}
