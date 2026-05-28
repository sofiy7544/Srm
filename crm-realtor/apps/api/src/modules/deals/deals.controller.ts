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
import { DealsService } from './deals.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  createDealSchema,
  updateDealSchema,
  dealFilterSchema,
  type CreateDealInput,
  type UpdateDealInput,
  type DealFilter,
} from '@crm/shared';

@Controller('deals')
@UseGuards(JwtAuthGuard)
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(dealFilterSchema)) filter: DealFilter,
  ) {
    return this.deals.list(user, filter);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deals.getById(user, id);
  }

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(createDealSchema)) body: CreateDealInput,
  ) {
    return this.deals.create(user, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateDealSchema)) body: UpdateDealInput,
  ) {
    return this.deals.update(user, id, body);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deals.remove(user, id);
  }
}
