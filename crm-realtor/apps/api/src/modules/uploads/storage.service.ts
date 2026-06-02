import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as path from 'path';
import type { BucketKind, StorageProvider } from './storage-provider.interface';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';

/**
 * Фасад хранилища. Выбирает провайдер автоматически:
 *   - если задан S3/MinIO (MINIO_ENDPOINT или AWS_S3_ENDPOINT) → S3StorageProvider
 *   - иначе → LocalStorageProvider (диск + раздача статикой)
 *
 * Публичный API (buildKey/uploadBuffer/signedUrlFromStoredUrl) сохранён —
 * вызывающий код (uploads, documents) не меняется.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private provider!: StorageProvider;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const s3Endpoint =
      this.config.get<string>('MINIO_ENDPOINT') ??
      this.config.get<string>('AWS_S3_ENDPOINT');

    if (s3Endpoint) {
      const s3 = new S3StorageProvider({
        endpoint: s3Endpoint,
        region: this.config.get<string>('AWS_REGION', 'us-east-1'),
        accessKeyId:
          this.config.get<string>('MINIO_ROOT_USER') ??
          this.config.get<string>('AWS_ACCESS_KEY_ID', 'minioadmin'),
        secretAccessKey:
          this.config.get<string>('MINIO_ROOT_PASSWORD') ??
          this.config.get<string>('AWS_SECRET_ACCESS_KEY', 'minioadmin_dev'),
        publicBucket:
          this.config.get<string>('MINIO_PUBLIC_BUCKET') ??
          this.config.get<string>('MINIO_BUCKET', 'crm-public'),
        privateBucket: this.config.get<string>('MINIO_PRIVATE_BUCKET', 'crm-private'),
      });
      await s3.init();
      this.provider = s3;
      this.logger.log(`Storage: S3-compatible (${s3Endpoint})`);
    } else {
      const rootDir = path.resolve(this.config.get<string>('UPLOAD_DIR', 'uploads'));
      const baseUrl =
        this.config.get<string>('PUBLIC_BASE_URL') ??
        this.config.get<string>('APP_URL') ??
        '';
      this.provider = new LocalStorageProvider(rootDir, baseUrl);
      this.logger.warn(
        `Storage: LOCAL disk (${rootDir}). Для продакшена с большим объёмом медиа задайте MINIO_ENDPOINT/AWS_S3_ENDPOINT.`,
      );
    }
  }

  buildKey(prefix: string, originalName: string): string {
    const ext = originalName.includes('.') ? originalName.split('.').pop() : 'bin';
    return `${prefix}/${randomUUID()}.${ext}`;
  }

  uploadBuffer(key: string, body: Buffer, contentType: string, kind: BucketKind = 'public') {
    return this.provider.uploadBuffer(key, body, contentType, kind);
  }

  signedUrlFromStoredUrl(storedUrl: string, ttlSeconds = 3600): Promise<string> {
    return this.provider.resolveUrl(storedUrl, ttlSeconds);
  }
}
