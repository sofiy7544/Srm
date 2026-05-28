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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { LeadsService } from './leads.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  createLeadSchema,
  updateLeadSchema,
  updateLeadStageSchema,
  bulkReassignSchema,
  type CreateLeadInput,
  type UpdateLeadInput,
  type UpdateLeadStageInput,
  type BulkReassignInput,
} from '@crm/shared';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.leads.list(user);
  }

  @Get('stats')
  stats(@CurrentUser() user: CurrentUserPayload) {
    return this.leads.stats(user);
  }

  @Get('pool')
  pool(@CurrentUser() user: CurrentUserPayload) {
    return this.leads.listPool(user);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leads.getById(user, id);
  }

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(createLeadSchema)) body: CreateLeadInput,
  ) {
    return this.leads.create(user, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateLeadSchema)) body: UpdateLeadInput,
  ) {
    return this.leads.update(user, id, body);
  }

  @Patch(':id/stage')
  changeStage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateLeadStageSchema)) body: UpdateLeadStageInput,
  ) {
    return this.leads.changeStage(user, id, body);
  }

  @Post('bulk-reassign')
  bulkReassign(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(bulkReassignSchema)) body: BulkReassignInput,
  ) {
    return this.leads.bulkReassign(user, body);
  }

  @Post(':id/claim')
  claim(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leads.claim(user, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leads.remove(user, id);
  }
}
