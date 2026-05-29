import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreatePaymentInput } from '@crm/shared';
import type { CurrentUserPayload } from '../auth/current-user.decorator';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  byDeal(dealId: string) {
    return this.prisma.payment.findMany({
      where: { dealId },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { paidAt: 'desc' },
    });
  }

  async create(actor: CurrentUserPayload, input: CreatePaymentInput) {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Только администратор может фиксировать выплаты');
    }
    const deal = await this.prisma.deal.findUnique({
      where: { id: input.dealId },
      select: { id: true, agentId: true },
    });
    if (!deal) throw new NotFoundException('Сделка не найдена');

    return this.prisma.payment.create({
      data: {
        dealId: input.dealId,
        userId: input.userId ?? deal.agentId,
        amount: input.amount,
        type: input.type,
        paidAt: new Date(input.paidAt),
        note: input.note,
      },
      include: { user: { select: { id: true, fullName: true } } },
    });
  }

  async remove(actor: CurrentUserPayload, id: string) {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Только администратор может удалять выплаты');
    }
    await this.prisma.payment.delete({ where: { id } });
    return { ok: true };
  }
}
