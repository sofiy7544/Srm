import { Global, Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { AutomationRulesController } from './automation.controller';
import { SchedulerService } from './scheduler.service';

@Global()
@Module({
  controllers: [AutomationRulesController],
  providers: [AutomationService, SchedulerService],
  exports: [AutomationService],
})
export class AutomationModule {}
