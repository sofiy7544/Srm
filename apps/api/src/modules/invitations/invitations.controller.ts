import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  inviteUserSchema,
  acceptInvitationSchema,
  type InviteUserInput,
  type AcceptInvitationInput,
} from '@crm/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { UserRole } from '@prisma/client';
import { InvitationsService } from './invitations.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly prisma: PrismaService,
  ) {}

  // --- Admin endpoints (authenticated) ---

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  async create(
    @Body(new ZodValidationPipe(inviteUserSchema)) body: InviteUserInput,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const inviter = await this.prisma.user.findUnique({ where: { id: user.userId } });
    if (!inviter) {
      throw new ForbiddenException('Inviter not found');
    }
    return this.invitations.invite(
      inviter.id,
      inviter.fullName,
      inviter.email,
      body.email,
      body.role,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  list() {
    return this.invitations.list();
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.invitations.revoke(id);
  }

  // --- Public endpoint: anyone with a valid token can accept ---

  @Post('accept')
  @HttpCode(201)
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  accept(
    @Body(new ZodValidationPipe(acceptInvitationSchema)) body: AcceptInvitationInput,
  ) {
    return this.invitations.accept(body);
  }
}
