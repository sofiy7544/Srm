import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface CursorOpts {
  cursor?: string;
  limit?: number;
  /** Фильтр по типу активности — для panel «Notes» передаём ['NOTE']. */
  types?: string[];
}

interface CreateActivityDto {
  clientId: string;
  leadId?: string;
  type: string;
  direction: string;
  content: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  byClient(clientId: string, opts: CursorOpts = {}) {
    return this.paginated({ clientId }, { ...opts });
  }

  byLead(leadId: string, opts: CursorOpts = {}) {
    return this.paginated({ leadId }, { ...opts });
  }

  async create(dto: CreateActivityDto) {
    if (!dto.clientId) throw new BadRequestException('clientId is required');
    return this.prisma.activity.create({
      data: {
        clientId: dto.clientId,
        leadId: dto.leadId ?? null,
        type: dto.type as never,
        direction: dto.direction as never,
        content: dto.content,
        userId: dto.userId,
        metadata: (dto.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
      include: { user: { select: { id: true, fullName: true } } },
    });
  }

  private async paginated(where: Record<string, unknown>, opts: CursorOpts) {
    const limit = Math.min(opts.limit ?? 50, 100);
    // Фильтр types — для отдельной панели «Заметки» (только тип NOTE).
    const finalWhere: Record<string, unknown> = { ...where };
    if (opts.types && opts.types.length > 0) {
      finalWhere.type = { in: opts.types };
    }
    const items = await this.prisma.activity.findMany({
      where: finalWhere,
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > limit;
    const slice = hasMore ? items.slice(0, limit) : items;
    return {
      items: slice,
      nextCursor: hasMore ? slice[slice.length - 1].id : null,
    };
  }
}
