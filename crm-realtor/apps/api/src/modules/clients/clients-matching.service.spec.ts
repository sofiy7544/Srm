import { PropertyStatus, UserRole } from '@prisma/client';
import { ClientsService } from './clients.service';
import type { CurrentUserPayload } from '../auth/current-user.decorator';

/**
 * Unit-тесты матчинга клиент↔объект (P0). Проверяют, что предпочтения клиента
 * корректно превращаются в Prisma-фильтр по доступным объектам. Prisma замокан.
 */

const ADMIN: CurrentUserPayload = {
  userId: 'admin-1',
  email: 'a@crm.local',
  role: UserRole.ADMIN,
};

function makeService(preferences: Record<string, unknown> | null) {
  const findMany = jest.fn().mockResolvedValue([{ id: 'prop-1', price: 80000 }]);
  const prisma = {
    client: {
      findUnique: jest.fn().mockResolvedValue({ assignedUserId: null, preferences }),
    },
    property: { findMany },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new ClientsService(prisma as any, {} as any, {} as any);
  return { service, findMany };
}

describe('ClientsService.matchProperties (P0 matching)', () => {
  it('нет preferences → reason no_preferences, БД не запрашивается', async () => {
    const { service, findMany } = makeService(null);
    const res = await service.matchProperties(ADMIN, 'client-1');
    expect(res).toMatchObject({ count: 0, reason: 'no_preferences' });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('строит фильтр: только AVAILABLE + бюджет + район', async () => {
    const { service, findMany } = makeService({
      propertyType: 'APARTMENT',
      dealIntent: 'BUY',
      priceMin: 50000,
      priceMax: 120000,
      roomsMin: 2,
      roomsMax: null,
      areaMin: null,
      areaMax: null,
      districts: ['Центр'],
    });
    const res = await service.matchProperties(ADMIN, 'client-1');

    expect(findMany).toHaveBeenCalledTimes(1);
    const where = findMany.mock.calls[0][0].where;
    expect(where.status).toBe(PropertyStatus.AVAILABLE);
    expect(where.type).toBe('APARTMENT');
    expect(where.dealIntent).toBe('BUY');
    expect(where.price).toEqual({ gte: 50000, lte: 120000 });
    expect(where.rooms).toEqual({ gte: 2 });
    expect(where.district).toEqual({ in: ['Центр'] });
    // results проброшены
    expect(res.count).toBe(1);
  });

  it('пустой список districts → фильтр по району не добавляется', async () => {
    const { service, findMany } = makeService({
      priceMax: 100000,
      districts: [],
      roomsMin: null,
      roomsMax: null,
      areaMin: null,
      areaMax: null,
    });
    await service.matchProperties(ADMIN, 'client-1');
    const where = findMany.mock.calls[0][0].where;
    expect(where.district).toBeUndefined();
    expect(where.price).toEqual({ lte: 100000 });
  });
});
