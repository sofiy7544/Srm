/**
 * Абстракция хранилища медиа. Позволяет менять бэкенд (локальный диск,
 * MinIO/S3, R2 и т.п.) без изменения вызывающего кода.
 *
 * Реализации:
 *   - LocalStorageProvider — файлы на диске, раздача статикой через API
 *     (дефолт когда не сконфигурирован S3/MinIO; работает на Railway volume).
 *   - S3StorageProvider — MinIO / AWS S3 / Cloudflare R2 (S3-совместимые).
 */

export type BucketKind = 'public' | 'private';

export interface UploadResult {
  key: string;
  url: string;
  kind: BucketKind;
}

export interface StorageProvider {
  /** Сохранить буфер; вернуть ключ и доступный URL. */
  uploadBuffer(
    key: string,
    body: Buffer,
    contentType: string,
    kind?: BucketKind,
  ): Promise<UploadResult>;

  /**
   * Привести сохранённый URL к актуальному (для private — подписать).
   * Для публичных провайдеров обычно возвращает тот же URL.
   */
  resolveUrl(storedUrl: string, ttlSeconds?: number): Promise<string>;
}
