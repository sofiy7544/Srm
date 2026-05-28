import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { PaymentsService } from './payments.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { createPaymentSchema, type CreatePaymentInput } from '@crm/shared';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('deal/:dealId')
  byDeal(@Param('dealId', ParseUUIDPipe) dealId: string) {
    return this.payments.byDeal(dealId);
  }

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(createPaymentSchema)) body: CreatePaymentInput,
  ) {
    return this.payments.create(user, body);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.remove(user, id);
  }
}
