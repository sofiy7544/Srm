import { BadRequestException } from '@nestjs/common';
import { LeadStage, UserRole } from '@prisma/client';
import { LeadsService } from './leads.service';
import type { CurrentUserPayload } from '../auth/current-user.decorator';

/**
 * Unit-тесты бизнес-логики назначения лида (поток /pool) и дедупликации.
 * Prisma и побочные сервисы замоканы — без реальной БД, детерминированно.
 *
 * Покрывает фикс P1: assignedUserId === null → unclaimed (в /pool);
 * undefined → дефолт (ответственный клиента / создатель); явный id → этот id.
 */

const ACTOR: CurrentUserPayload = {
  userId: 'actor-1',
  email: 'a@crm.local',
  role: UserRole.ADMIN,
};

function makeService() {
  // Захватываем data, переданную в lead.create — это и есть проверяемое поведение.
  const created: { data?: { assignedUserId: string | null } } = {};

  const prisma = {
    client: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'client-1',
        assignedUserId: null,
        isBlacklisted: false,
        isArchived: false,
        fullName: 'Test Client',
      }),
    },
    lead: {
      findFirst: jest.fn().mockResolvedValue(null), // нет активного дубля
      create: jest.fn().mockImplementation((args: { data: { assignedUserId: string | null } }) => {
        created.data = args.data;
        return Promise.resolve({
          id: 'lead-1',
          clientId: 'client-1',
          assignedUserId: args.data.assignedUserId,
          client: { fullName: 'Test Client' },
        });
      }),
    },
    property: { findUnique: jest.fn() },
    activity: { create: jest.fn().mockResolvedValue({}) },
  };

  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const automation = { runOnLeadCreate: jest.fn().mockResolvedValue(undefined) };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new LeadsService(prisma as any, notifications as any, automation as any);
  return { service, prisma, notifications, created };
}

describe('LeadsService.create — назначение (поток /pool)', () => {
  it('assignedUserId === null → лид unclaimed (попадёт в /pool)', async () => {
    const { service, created } = makeService();
    await service.create(ACTOR, {
      clientId: 'client-1',
      assignedUserId: null,
      stage: LeadStage.NEW,
      dealIntent: 'BUY',
    });
    expect(created.data?.assignedUserId).toBeNull();
  });

  it('assignedUserId === undefined → дефолт на создателя (когда у клиента нет ответственного)', async () => {
    const { service, created } = makeService();
    await service.create(ACTOR, {
      clientId: 'client-1',
      stage: LeadStage.NEW,
      dealIntent: 'BUY',
    });
    expect(created.data?.assignedUserId).toBe('actor-1');
  });

  it('явный assignedUserId → именно он', async () => {
    const { service, created } = makeService();
    await service.create(ACTOR, {
      clientId: 'client-1',
      assignedUserId: 'realtor-9',
      stage: LeadStage.NEW,
      dealIntent: 'BUY',
    });
    expect(created.data?.assignedUserId).toBe('realtor-9');
  });

  it('undefined + у клиента есть ответственный → наследует ответственного клиента', async () => {
    const { service, prisma, created } = makeService();
    prisma.client.findUnique.mockResolvedValueOnce({
      id: 'client-1',
      assignedUserId: 'owner-7',
      isBlacklisted: false,
      isArchived: false,
      fullName: 'Test Client',
    });
    await service.create(ACTOR, {
      clientId: 'client-1',
      stage: LeadStage.NEW,
      dealIntent: 'BUY',
    });
    expect(created.data?.assignedUserId).toBe('owner-7');
  });

  it('дедуп: активный лид уже есть → BadRequestException, новый не создаётся', async () => {
    const { service, prisma } = makeService();
    prisma.lead.findFirst.mockResolvedValueOnce({ id: 'dup-1', stage: LeadStage.NEW });
    await expect(
      service.create(ACTOR, { clientId: 'client-1', stage: LeadStage.NEW, dealIntent: 'BUY' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });
});
