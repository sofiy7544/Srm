import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('unread') unread?: string,
  ) {
    return this.notifications.listForUser(user.userId, unread === '1' || unread === 'true');
  }

  @Get('unread-count')
  async unread(@CurrentUser() user: CurrentUserPayload) {
    return { count: await this.notifications.unreadCount(user.userId) };
  }

  @Post(':id/read')
  read(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(user.userId, id);
  }

  @Post('read-all')
  readAll(@CurrentUser() user: CurrentUserPayload) {
    return this.notifications.markAllRead(user.userId);
  }
}
