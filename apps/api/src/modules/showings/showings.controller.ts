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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { ShowingsService } from './showings.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  createShowingSchema,
  updateShowingSchema,
  showingFilterSchema,
  type CreateShowingInput,
  type UpdateShowingInput,
  type ShowingFilter,
} from '@crm/shared';

@Controller('showings')
@UseGuards(JwtAuthGuard)
export class ShowingsController {
  constructor(private readonly showings: ShowingsService) {}

  @Get()
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(showingFilterSchema)) filter: ShowingFilter,
  ) {
    return this.showings.list(user, filter);
  }

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(createShowingSchema)) body: CreateShowingInput,
  ) {
    return this.showings.create(user, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateShowingSchema)) body: UpdateShowingInput,
  ) {
    return this.showings.update(user, id, body);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.showings.remove(user, id);
  }
}
