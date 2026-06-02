import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorageService } from './storage.service';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; //  10 MB images
const MAX_VIDEO_BYTES = 80 * 1024 * 1024; //  80 MB videos
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; //  25 MB voice notes (≈ 25 минут MP4-AAC)
// HEIC/HEIF — формат фото с камеры iPhone (Safari часто отправляет его).
const ALLOWED_IMAGE = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);
const ALLOWED_VIDEO = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
// Audio MIME-типы — браузеры по-разному именуют:
//   - Chrome/Firefox MediaRecorder → audio/webm
//   - Safari/iOS MediaRecorder    → audio/mp4 (или audio/aac)
//   - Native upload                → audio/mpeg (mp3), audio/wav
const ALLOWED_AUDIO = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
  'audio/m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
]);

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  /** Старый эндпойнт — оставляем для совместимости (только image). */
  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не получен. Попробуйте ещё раз.');
    if (file.size === 0) throw new BadRequestException('Файл пустой или повреждён.');
    if (!ALLOWED_IMAGE.has(file.mimetype)) {
      throw new BadRequestException('Формат файла не поддерживается. Используйте JPG, PNG, WEBP или HEIC.');
    }
    const key = this.storage.buildKey('properties', file.originalname);
    const result = await this.storage.uploadBuffer(key, file.buffer, file.mimetype, 'public');
    return { key: result.key, url: result.url, size: file.size, contentType: file.mimetype };
  }

  /**
   * Универсальный эндпойнт для медиа объекта: принимает image/* и video/*.
   * Возвращает { url, kind: 'PHOTO'|'VIDEO' } чтобы клиент сразу знал, что записывать в БД.
   */
  @Post('media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_VIDEO_BYTES } }))
  async uploadMedia(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не получен. Попробуйте ещё раз.');
    if (file.size === 0) throw new BadRequestException('Файл пустой или повреждён.');
    const mime = file.mimetype;

    let kind: 'PHOTO' | 'VIDEO';
    if (ALLOWED_IMAGE.has(mime)) {
      if (file.size > MAX_IMAGE_BYTES) {
        throw new BadRequestException('Размер изображения превышает 10 МБ.');
      }
      kind = 'PHOTO';
    } else if (ALLOWED_VIDEO.has(mime)) {
      kind = 'VIDEO';
    } else {
      throw new BadRequestException('Формат файла не поддерживается. Фото: JPG, PNG, WEBP, HEIC. Видео: MP4, MOV, WEBM.');
    }

    const folder = kind === 'VIDEO' ? 'properties/videos' : 'properties';
    const key = this.storage.buildKey(folder, file.originalname);
    const result = await this.storage.uploadBuffer(key, file.buffer, mime, 'public');
    return {
      key: result.key,
      url: result.url,
      kind,
      size: file.size,
      contentType: mime,
    };
  }

  /**
   * Загрузка голосовых заметок риелтора (диктовка после показа, follow-up note и т.п.).
   * Принимает audio/* из MediaRecorder API (Chrome/Firefox шлют webm, Safari/iOS — mp4),
   * либо нативные mp3/wav/ogg при ручной загрузке. Складываем в `voice-notes/`.
   *
   * Опциональный параметр `duration` (ms) можно передать в multipart — но мы его
   * не валидируем серверно: длительность аудио клиент считает сам и кладёт в
   * Activity.metadata.duration вместе с URL.
   */
  @Post('audio')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_AUDIO_BYTES } }))
  async uploadAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File missing');
    const mime = file.mimetype;
    if (!ALLOWED_AUDIO.has(mime)) {
      throw new BadRequestException(`Unsupported audio type: ${mime}`);
    }
    const key = this.storage.buildKey('voice-notes', file.originalname || 'voice.webm');
    const result = await this.storage.uploadBuffer(key, file.buffer, mime, 'public');
    return {
      key: result.key,
      url: result.url,
      size: file.size,
      contentType: mime,
    };
  }
}
