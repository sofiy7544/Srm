import {
  BadRequestException, Body, Controller, Delete, Get,
  Param, ParseUUIDPipe, Post, Query, UploadedFile,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { DocumentType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { DocumentsService } from './documents.service';
import { StorageService } from '../uploads/storage.service';

const MAX_BYTES = 25 * 1024 * 1024;

const uploadSchema = z.object({
  clientId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  type: z.nativeEnum(DocumentType).default(DocumentType.OTHER),
});

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async list(
    @Query('clientId') clientId?: string,
    @Query('dealId') dealId?: string,
    @Query('propertyId') propertyId?: string,
  ) {
    const docs = await this.documents.list({ clientId, dealId, propertyId });
    return Promise.all(
      docs.map(async (d) => ({
        ...d,
        fileUrl: await this.storage.signedUrlFromStoredUrl(d.fileUrl, 3600),
      })),
    );
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  async upload(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body(new ZodValidationPipe(uploadSchema)) meta: z.infer<typeof uploadSchema>,
  ) {
    if (!file) throw new BadRequestException('File not provided');
    const key = this.storage.buildKey('documents', file.originalname);
    const result = await this.storage.uploadBuffer(key, file.buffer, file.mimetype, 'private');
    const doc = await this.documents.create({
      ...meta,
      fileUrl: result.url,
      originalName: file.originalname,
      mime: file.mimetype,
      uploadedById: user.userId,
    });
    return { ...doc, fileUrl: result.url };
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documents.remove(user, id);
  }
}
