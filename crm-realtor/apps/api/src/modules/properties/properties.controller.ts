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
import { PropertiesService } from './properties.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import {
  createPropertySchema,
  updatePropertySchema,
  propertyFilterSchema,
  mediaUrlSchema,
  type CreatePropertyInput,
  type UpdatePropertyInput,
  type PropertyFilter,
} from '@crm/shared';
import { z } from 'zod';

const addPhotoSchema = z.object({
  // Абсолютный URL (S3/публичный) ИЛИ относительный '/uploads/...' (local storage).
  url: mediaUrlSchema,
  isCover: z.boolean().optional(),
  kind: z.enum(['PHOTO', 'VIDEO']).optional(),
  // Telegram-grade media metadata (best-effort, produced by the upload pipeline).
  thumbnailUrl: mediaUrlSchema.optional().nullable(),
  posterUrl: mediaUrlSchema.optional().nullable(),
  blurhash: z.string().max(200).optional().nullable(),
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
  durationMs: z.number().int().nonnegative().optional().nullable(),
  mimeType: z.string().max(120).optional().nullable(),
  sizeBytes: z.number().int().nonnegative().optional().nullable(),
});
type AddPhotoInput = z.infer<typeof addPhotoSchema>;

const reorderPhotosSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});
type ReorderPhotosInput = z.infer<typeof reorderPhotosSchema>;

@Controller('properties')
@UseGuards(JwtAuthGuard)
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(propertyFilterSchema)) query: PropertyFilter,
  ) {
    return this.properties.list(query, user.userId);
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.properties.getById(id);
  }

  /** История изменения цены объекта. */
  @Get(':id/price-history')
  priceHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.properties.priceHistory(id);
  }

  /** Матчинг: подходящие клиенты-покупатели под этот объект. */
  @Get(':id/matches')
  matchForProperty(@Param('id', ParseUUIDPipe) id: string) {
    return this.properties.matchForProperty(id);
  }

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(createPropertySchema)) body: CreatePropertyInput,
  ) {
    return this.properties.create(body, user.userId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePropertySchema)) body: UpdatePropertyInput,
  ) {
    return this.properties.update(id, body, user.userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.properties.remove(id);
  }

  @Post(':id/photos')
  addPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(addPhotoSchema)) body: AddPhotoInput,
  ) {
    return this.properties.addPhoto(id, body);
  }

  /** Persist a new drag-and-drop order. Body: { ids: [...] } in display order. */
  @Patch(':id/photos/reorder')
  reorderPhotos(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reorderPhotosSchema)) body: ReorderPhotosInput,
  ) {
    return this.properties.reorderPhotos(id, body.ids);
  }

  /** Mark one photo as the cover (unsets the others). */
  @Patch(':id/photos/:photoId/cover')
  setCover(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.properties.setCover(id, photoId);
  }

  @Delete(':id/photos/:photoId')
  removePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.properties.removePhoto(id, photoId);
  }
}
