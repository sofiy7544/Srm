import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { canSeeOwnedResource, getAccessibleUserIds } from '../../common/rbac';

@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(
    private readonly svc: ActivitiesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('client/:id')
  async byClient(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('types') types?: string,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true, assignedUserId: true },
    });
    if (!client) throw new NotFoundException('Client not found');
    const accessible = await getAccessibleUserIds(this.prisma, {
      id: user.userId,
      role: user.role,
    });
    if (!canSeeOwnedResource(accessible, client.assignedUserId)) {
      throw new ForbiddenException();
    }
    // ?types=NOTE,CALL — для панели «Заметки» передаём ?types=NOTE
    const typeList = types ? types.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    return this.svc.byClient(id, { cursor, types: typeList });
  }

  @Get('lead/:id')
  async byLead(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('types') types?: string,
  ) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      select: { id: true, assignedUserId: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    const accessible = await getAccessibleUserIds(this.prisma, {
      id: user.userId,
      role: user.role,
    });
    if (!canSeeOwnedResource(accessible, lead.assignedUserId)) {
      throw new ForbiddenException();
    }
    const typeList = types ? types.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    return this.svc.byLead(id, { cursor, types: typeList });
  }

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: {
      clientId: string;
      leadId?: string;
      type: string;
      direction: string;
      content: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.svc.create({ ...body, userId: user.userId });
  }
}
