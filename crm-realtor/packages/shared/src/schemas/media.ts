import { z } from 'zod';

/**
 * URL загруженного медиа. Принимает:
 *   - абсолютный http(s) URL (S3 / публичный storage)
 *   - корневой относительный путь '/uploads/...' (LocalStorageProvider при
 *     пустом PUBLIC_BASE_URL — same-origin раздача через API).
 *
 * Используется вместо z.string().url(), который отклонял относительные пути и
 * приводил к «Validation failed» при загрузке фото на локальном хранилище.
 */
export const mediaUrlSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine((v) => /^https?:\/\//.test(v) || v.startsWith('/'), {
    message: 'URL must be absolute (http/https) or a root-relative path',
  });
