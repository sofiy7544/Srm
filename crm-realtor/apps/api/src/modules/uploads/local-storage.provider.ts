import { Logger, InternalServerErrorException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { BucketKind, StorageProvider, UploadResult } from './storage-provider.interface';

/**
 * Локальное файловое хранилище. Файлы кладутся на диск (UPLOAD_DIR, по умолчанию
 * ./uploads), раздаются статикой через API по PUBLIC_BASE_URL + /uploads/<key>.
 *
 * Подходит для Railway с персистентным volume, смонтированным в UPLOAD_DIR.
 * Без volume переживёт до перезапуска контейнера — для прод-эксплуатации с
 * большим объёмом медиа рекомендуется S3-провайдер (см. S3StorageProvider).
 */
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);

  constructor(
    private readonly rootDir: string,
    /** Базовый публичный URL API (для построения ссылок на файлы). */
    private readonly publicBaseUrl: string,
  ) {}

  async uploadBuffer(
    key: string,
    body: Buffer,
    _contentType: string,
    kind: BucketKind = 'public',
  ): Promise<UploadResult> {
    const dest = path.join(this.rootDir, key);
    try {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, body);
    } catch (e) {
      // Чаще всего EACCES: volume смонтирован root-owned, а процесс под non-root.
      this.logger.error(`Local upload failed (${this.rootDir}): ${(e as Error).message}`);
      throw new InternalServerErrorException(
        'Не удалось сохранить файл на сервере. Обратитесь к администратору (storage).',
      );
    }
    const base = this.publicBaseUrl.replace(/\/+$/, '');
    return { key, url: `${base}/uploads/${key}`, kind };
  }

  // Локальные файлы публичны по статике — URL не требует подписи.
  async resolveUrl(storedUrl: string): Promise<string> {
    return storedUrl;
  }
}
