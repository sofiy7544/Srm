import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { StorageService } from './storage.service';
import { MediaProcessor } from './media-processor';

@Module({
  controllers: [UploadsController],
  providers: [StorageService, MediaProcessor],
  exports: [StorageService, MediaProcessor],
})
export class UploadsModule {}
