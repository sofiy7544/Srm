import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { PresentationService } from './presentation.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

const sendSchema = z.object({ clientId: z.string().uuid() });
type SendInput = z.infer<typeof sendSchema>;

@Controller('properties/:id/presentation')
@UseGuards(JwtAuthGuard)
export class PresentationController {
  constructor(private readonly presentation: PresentationService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  async render(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const html = await this.presentation.render(id);
    res.send(html);
  }

  @Post('send')
  send(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(sendSchema)) body: SendInput,
  ) {
    return this.presentation.sendByEmail(user, id, body.clientId);
  }
}
