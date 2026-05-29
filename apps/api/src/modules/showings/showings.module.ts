import { Module } from '@nestjs/common';
import { ShowingsController } from './showings.controller';
import { ShowingsService } from './showings.service';

@Module({
  controllers: [ShowingsController],
  providers: [ShowingsService],
  exports: [ShowingsService],
})
export class ShowingsModule {}
