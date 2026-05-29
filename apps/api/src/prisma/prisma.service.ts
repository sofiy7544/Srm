import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    // Auto-bump Lead.lastActivityAt whenever an Activity is created with a leadId.
    // This is the single source of truth for "last touch" — used by stale detection,
    // sorting, and dormant-client analytics. Done as middleware (not Postgres trigger)
    // so we keep the schema portable and the rule lives next to the data layer.
    this.$use(async (params, next) => {
      const result = await next(params);
      if (params.model === 'Activity' && params.action === 'create') {
        const leadId = (params.args?.data as { leadId?: string | null })?.leadId;
        if (leadId) {
          this.lead
            .update({ where: { id: leadId }, data: { lastActivityAt: new Date() } })
            .catch((e) =>
              this.logger.warn(
                `Failed to bump lastActivityAt for lead ${leadId}: ${(e as Error).message}`,
              ),
            );
        }
      }
      return result;
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
