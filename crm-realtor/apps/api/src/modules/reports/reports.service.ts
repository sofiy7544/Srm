import { Injectable } from '@nestjs/common';
import { DealStatus, LeadStage, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [
      totalClients,
      totalProperties,
      activeLeads,
      completedDeals,
      sumCompleted,
    ] = await this.prisma.$transaction([
      this.prisma.client.count(),
      this.prisma.property.count(),
      this.prisma.lead.count({
        where: { stage: { notIn: [LeadStage.WON, LeadStage.LOST] } },
      }),
      this.prisma.deal.count({ where: { status: DealStatus.COMPLETED } }),
      this.prisma.deal.aggregate({
        _sum: { amount: true, commissionAmount: true },
        where: { status: DealStatus.COMPLETED },
      }),
    ]);
    return {
      totalClients,
      totalProperties,
      activeLeads,
      completedDeals,
      totalAmount: Number(sumCompleted._sum.amount ?? 0),
      totalCommission: Number(sumCompleted._sum.commissionAmount ?? 0),
    };
  }

  async leadsByChannel() {
    const grouped = await this.prisma.lead.groupBy({
      by: ['sourceId'],
      _count: { _all: true },
    });
    const sources = await this.prisma.source.findMany();
    const map = new Map(sources.map((s) => [s.id, s.name]));
    return grouped.map((g) => ({
      sourceId: g.sourceId,
      sourceName: g.sourceId ? map.get(g.sourceId) ?? '—' : 'Без источника',
      count: g._count._all,
    }));
  }

  async funnelConversion() {
    const grouped = await this.prisma.lead.groupBy({
      by: ['stage'],
      _count: { _all: true },
    });
    const result: Record<string, number> = {};
    for (const g of grouped) result[g.stage] = g._count._all;
    return result;
  }

  async agentActivity() {
    const agents = await this.prisma.user.findMany({
      where: { role: { in: [UserRole.REALTOR, UserRole.ASSISTANT] }, isActive: true },
      select: { id: true, fullName: true },
    });

    const results = await Promise.all(
      agents.map(async (a) => {
        const [leadsCount, callsCount, showingsCount, dealsAgg] = await this.prisma.$transaction([
          this.prisma.lead.count({ where: { assignedUserId: a.id } }),
          this.prisma.activity.count({
            where: { userId: a.id, type: 'CALL' },
          }),
          this.prisma.showing.count({ where: { agentId: a.id } }),
          this.prisma.deal.aggregate({
            _count: { _all: true },
            _sum: { commissionAmount: true },
            where: { agentId: a.id, status: DealStatus.COMPLETED },
          }),
        ]);
        return {
          userId: a.id,
          fullName: a.fullName,
          leads: leadsCount,
          calls: callsCount,
          showings: showingsCount,
          deals: dealsAgg._count._all,
          commission: Number(dealsAgg._sum.commissionAmount ?? 0),
        };
      }),
    );
    return results;
  }

  /**
   * Team workload snapshot — for the Manager / Admin dashboard.
   * Per agent: active leads count, OVERDUE tasks, last activity, availability.
   * Helps a 10+ person team see who's drowning and who's free.
   */
  async teamWorkload() {
    const agents = await this.prisma.user.findMany({
      where: { isActive: true, role: { in: [UserRole.REALTOR, UserRole.ASSISTANT, UserRole.EMPLOYEE] } },
      select: { id: true, fullName: true, email: true, role: true, isAvailable: true },
      orderBy: { fullName: 'asc' },
    });

    const stats = await Promise.all(
      agents.map(async (a) => {
        const [activeLeads, overdueTasks, todayTasks, lastActivity] = await Promise.all([
          this.prisma.lead.count({
            where: { assignedUserId: a.id, stage: { notIn: ['WON', 'LOST'] } },
          }),
          this.prisma.task.count({
            where: { userId: a.id, status: 'OVERDUE' },
          }),
          this.prisma.task.count({
            where: {
              userId: a.id,
              status: { in: ['PENDING', 'OVERDUE'] },
              dueAt: { lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
            },
          }),
          this.prisma.activity.findFirst({
            where: { userId: a.id },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          }),
        ]);
        return {
          userId: a.id,
          fullName: a.fullName,
          email: a.email,
          role: a.role,
          isAvailable: a.isAvailable,
          activeLeads,
          overdueTasks,
          todayTasks,
          lastActivityAt: lastActivity?.createdAt ?? null,
        };
      }),
    );
    return stats;
  }

  async recentActivity(limit = 12) {
    return this.prisma.activity.findMany({
      include: {
        user: { select: { id: true, fullName: true } },
        client: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async upcomingShowings(limit = 8) {
    return this.prisma.showing.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { gte: new Date() } },
      include: {
        property: { select: { id: true, address: true } },
        client: { select: { id: true, fullName: true } },
        agent: { select: { id: true, fullName: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
  }

  async recentLeads(limit = 8) {
    return this.prisma.lead.findMany({
      include: {
        client: { select: { id: true, fullName: true, primaryPhone: true } },
        source: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async todayTasks(userId: string) {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return this.prisma.task.findMany({
      where: {
        userId,
        status: { in: ['PENDING', 'OVERDUE'] },
        dueAt: { lte: end },
      },
      include: {
        client: { select: { id: true, fullName: true } },
        lead: { select: { id: true, stage: true } },
      },
      orderBy: { dueAt: 'asc' },
      take: 12,
    });
  }

  async sourceRoi() {
    type Row = {
      sourceId: string;
      sourceName: string;
      leads: bigint | number;
      deals: bigint | number;
      revenue: string | number | null;
      commission: string | number | null;
    };
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT
        s.id AS "sourceId",
        s.name AS "sourceName",
        COUNT(DISTINCT l.id)::int AS "leads",
        COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'COMPLETED')::int AS "deals",
        COALESCE(SUM(CASE WHEN d.status = 'COMPLETED' THEN d.amount ELSE 0 END), 0)::text AS "revenue",
        COALESCE(SUM(CASE WHEN d.status = 'COMPLETED' THEN d.commission_amount ELSE 0 END), 0)::text AS "commission"
      FROM sources s
      LEFT JOIN leads l ON l.source_id = s.id
      LEFT JOIN deals d ON d.lead_id = l.id
      GROUP BY s.id, s.name
      ORDER BY "commission" DESC NULLS LAST;
    `;
    return rows.map((r) => {
      const leads = Number(r.leads ?? 0);
      const deals = Number(r.deals ?? 0);
      return {
        sourceId: r.sourceId,
        sourceName: r.sourceName,
        leads,
        deals,
        revenue: Number(r.revenue ?? 0),
        commission: Number(r.commission ?? 0),
        conversion: leads > 0 ? Math.round((deals / leads) * 100) : 0,
      };
    });
  }

  async leadHealth(actor: { userId: string; role: string }) {
    const isAdmin = actor.role === 'ADMIN' || actor.role === 'MANAGER';
    const where: Record<string, unknown> = { stage: { notIn: [LeadStage.WON, LeadStage.LOST] } };
    if (!isAdmin) where.assignedUserId = actor.userId;

    const leads = await this.prisma.lead.findMany({
      where,
      include: {
        client: { select: { id: true, fullName: true } },
        source: { select: { type: true } },
        _count: { select: { activities: true } },
      },
      orderBy: { stageChangedAt: 'asc' },
    });

    return leads.map((l) => {
      const daysSinceStageChange = Math.floor((Date.now() - new Date(l.stageChangedAt).getTime()) / 86400000);
      const isStale = daysSinceStageChange > 7;
      return {
        id: l.id,
        clientName: l.client.fullName,
        stage: l.stage,
        priority: l.priority ?? 'warm',
        daysSinceStageChange,
        isStale,
        activityCount: l._count.activities,
        sourceType: l.source?.type ?? null,
      };
    });
  }
}
