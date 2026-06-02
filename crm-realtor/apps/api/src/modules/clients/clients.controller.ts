import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { ClientsService } from './clients.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { clientFilterSchema, mediaUrlSchema, type ClientFilter } from '@crm/shared';
import {
  createClientSchema,
  updateClientSchema,
  type CreateClientInput,
  type UpdateClientInput,
} from '@crm/shared';

const logCallSchema = z.object({
  outcome: z.enum(['ANSWERED', 'NO_ANSWER', 'BUSY']).default('ANSWERED'),
  note: z.string().max(2000).optional(),
});
type LogCallInput = z.infer<typeof logCallSchema>;

// Заметка может прикреплять голосовое (audioUrl + duration в ms). Если voice есть —
// content может быть пустой (минимум 0). Если voice нет — content обязателен (≥1).
const voiceMetaSchema = z.object({
  audioUrl: mediaUrlSchema,
  durationMs: z.number().int().min(0).max(60 * 60 * 1000), // до 1 часа sanity-cap
  mime: z.string().max(100).optional(),
});
const noteSchema = z
  .object({
    content: z.string().max(5000).default(''),
    voice: voiceMetaSchema.optional(),
  })
  .refine((v) => v.content.trim().length > 0 || !!v.voice, {
    message: 'Note must have text or voice',
    path: ['content'],
  });
type NoteInput = z.infer<typeof noteSchema>;

const sendEmailSchema = z.object({
  subject: z.string().min(1).max(200),
  templateId: z.string().uuid().optional(),
  body: z.string().max(50000).optional(),
});
type SendEmailInput = z.infer<typeof sendEmailSchema>;

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(clientFilterSchema)) query: ClientFilter,
  ) {
    return this.clients.list(user, query);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clients.getById(user, id);
  }

  /** Матчинг: подходящие объекты под предпочтения клиента. */
  @Get(':id/matches')
  matches(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clients.matchProperties(user, id);
  }

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(createClientSchema)) body: CreateClientInput,
  ) {
    return this.clients.create(user, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateClientSchema)) body: UpdateClientInput,
  ) {
    return this.clients.update(user, id, body);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clients.remove(user, id);
  }

  @Post(':id/merge')
  merge(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) winnerId: string,
    @Body(new ZodValidationPipe(z.object({ loserId: z.string().uuid() }))) body: { loserId: string },
  ) {
    return this.clients.merge(user, winnerId, body.loserId);
  }

  @Post(':id/log-call')
  logCall(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(logCallSchema)) body: LogCallInput,
  ) {
    return this.clients.logCall(user, id, body);
  }

  @Post(':id/note')
  addNote(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(noteSchema)) body: NoteInput,
  ) {
    return this.clients.addNote(user, id, body.content, body.voice);
  }

  @Post(':id/send-email')
  sendEmail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(sendEmailSchema)) body: SendEmailInput,
  ) {
    return this.clients.sendEmail(user, id, body);
  }
}
