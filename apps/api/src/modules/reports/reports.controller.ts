import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  dashboard() {
    return this.reports.dashboard();
  }

  @Get('leads-by-channel')
  leadsByChannel() {
    return this.reports.leadsByChannel();
  }

  @Get('funnel')
  funnel() {
    return this.reports.funnelConversion();
  }

  @Get('agents')
  agentActivity() {
    return this.reports.agentActivity();
  }

  @Get('team-workload')
  teamWorkload() {
    return this.reports.teamWorkload();
  }

  @Get('source-roi')
  sourceRoi() {
    return this.reports.sourceRoi();
  }

  @Get('recent-activity')
  recentActivity() {
    return this.reports.recentActivity();
  }

  @Get('upcoming-showings')
  upcomingShowings() {
    return this.reports.upcomingShowings();
  }

  @Get('recent-leads')
  recentLeads() {
    return this.reports.recentLeads();
  }

  @Get('today-tasks')
  todayTasks(@CurrentUser() user: CurrentUserPayload) {
    return this.reports.todayTasks(user.userId);
  }

  @Get('lead-health')
  leadHealth(@CurrentUser() user: CurrentUserPayload) {
    return this.reports.leadHealth(user);
  }
}