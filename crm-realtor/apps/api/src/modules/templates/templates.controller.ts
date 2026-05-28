import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { TemplatesService } from './templates.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

const templateSchema = z.object({
  name: z.string().min(1).max(120),
  language: z.enum(['uk', 'ru']),
  content: z.string().min(1).max(50000),
  isActive: z.boolean().optional(),
});
const updateSchema = templateSchema.partial();
type TemplateInput = z.infer<typeof templateSchema>;
type UpdateTemplateInput = z.infer<typeof updateSchema>;

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list() {
    return this.templates.list();
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.getById(id);
  }

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(templateSchema)) body: TemplateInput,
  ) {
    return this.templates.create(user, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateSchema)) body: UpdateTemplateInput,
  ) {
    return this.templates.update(user, id, body);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templates.remove(user, id);
  }
}
