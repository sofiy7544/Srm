import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { ContactChannel } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { MessagesService } from './messages.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

const sendSchema = z.object({
  channel: z.nativeEnum(ContactChannel),
  body: z.string().min(1).max(4000),
});
type SendInput = z.infer<typeof sendSchema>;

@Controller('clients/:clientId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  list(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query('channel') channel?: ContactChannel,
  ) {
    return this.messages.listForClient(clientId, channel);
  }

  @Post()
  send(
    @CurrentUser() user: CurrentUserPayload,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body(new ZodValidationPipe(sendSchema)) body: SendInput,
  ) {
    return this.messages.send(user, clientId, body);
  }
}
