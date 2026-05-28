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
  type CreatePropertyInput,
  type UpdatePropertyInput,
  type PropertyFilter,
} from '@crm/shared';
import { z } from 'zod';

const addPhotoSchema = z.object({
  url: z.string().url(),
  isCover: z.boolean().optional(),
  kind: z.enum(['PHOTO', 'VIDEO']).optional(),
});
type AddPhotoInput = z.infer<typeof addPhotoSchema>;

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

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(createPropertySchema)) body: CreatePropertyInput,
  ) {
    return this.properties.create(body, user.userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePropertySchema)) body: UpdatePropertyInput,
  ) {
    return this.properties.update(id, body);
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
    return this.properties.addPhoto(id, body.url, body.isCover, body.kind);
  }

  @Delete(':id/photos/:photoId')
  removePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.properties.removePhoto(id, photoId);
  }
}
