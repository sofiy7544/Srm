import { Module } from '@nestjs/common';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  controllers: [DealsController, PaymentsController, ContractsController],
  providers: [DealsService, PaymentsService, ContractsService],
  exports: [DealsService],
})
export class DealsModule {}
