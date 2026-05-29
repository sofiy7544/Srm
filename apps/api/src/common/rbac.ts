import { UserRole, PrismaClient } from '@prisma/client';

/**
 * Иерархия ролей CRM.
 *
 * - ADMIN — полный доступ ко всему, управление пользователями и ролями.
 * - MANAGER — руководитель команды: видит себя + подчинённых (User.managerId).
 * - EMPLOYEE / REALTOR / ASSISTANT / ANALYST — рядовой сотрудник:
 *     видит только свои данные.
 *
 * REALTOR/ASSISTANT/ANALYST остались в enum ради обратной совместимости с
 * данными, накопленными до перехода на тройку ADMIN/MANAGER/EMPLOYEE. На уровне
 * прав они трактуются как EMPLOYEE.
 */

export const ROLE_LEVELS: Record<UserRole, number> = {
  ADMIN: 100,
  MANAGER: 50,
  EMPLOYEE: 10,
  REALTOR: 10,
  ASSISTANT: 10,
  ANALYST: 10,
};

export function isAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

export function isManagerOrAbove(role: UserRole): boolean {
  return ROLE_LEVELS[role] >= ROLE_LEVELS.MANAGER;
}

export function isEmployeeOnly(role: UserRole): boolean {
  return ROLE_LEVELS[role] < ROLE_LEVELS.MANAGER;
}

/**
 * Возвращает список user.id, данные которых может видеть `actor`:
 *   - ADMIN → `null` (нет ограничений, видно всё)
 *   - MANAGER → [actor.id, ...подчинённые]
 *   - остальные → [actor.id]
 *
 * Тип `null` использует вызывающая сторона как сигнал «не накладывать
 * фильтр». Это чище, чем сравнивать длину массива.
 */
export async function getAccessibleUserIds(
  prisma: Pick<PrismaClient, 'user'>,
  actor: { id: string; role: UserRole },
): Promise<string[] | null> {
  if (isAdmin(actor.role)) return null;
  if (isManagerOrAbove(actor.role)) {
    const reports = await prisma.user.findMany({
      where: { managerId: actor.id },
      select: { id: true },
    });
    return [actor.id, ...reports.map((u) => u.id)];
  }
  return [actor.id];
}

/**
 * Может ли пользователь `actor` менять/смотреть данные пользователя `target`.
 *
 *  - ADMIN может всё.
 *  - MANAGER может управлять подчинёнными (target.managerId === actor.id) и
 *    собой.
 *  - Остальные — только собой.
 */
export function canActOnUser(
  actor: { id: string; role: UserRole },
  target: { id: string; managerId: string | null },
): boolean {
  if (isAdmin(actor.role)) return true;
  if (actor.id === target.id) return true;
  if (isManagerOrAbove(actor.role) && target.managerId === actor.id) return true;
  return false;
}

/**
 * Проверка доступа к ресурсу, у которого есть «владелец» — поле userId / agentId /
 * assignedUserId. Бросает ForbiddenError при отказе.
 *
 * Не используется напрямую — вызывающая сторона передаёт уже извлечённый
 * `accessibleIds` (см. `getAccessibleUserIds`) и проверяет через `.includes()`,
 * иначе пришлось бы делать N+1 запросов.
 */
export function canSeeOwnedResource(
  accessibleIds: string[] | null,
  ownerId: string | null | undefined,
): boolean {
  if (accessibleIds === null) return true; // admin
  if (!ownerId) return false;
  return accessibleIds.includes(ownerId);
}
