import { Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { BucketKind, StorageProvider, UploadResult } from './storage-provider.interface';

export interface S3ProviderConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBucket: string;
  privateBucket: string;
}

/**
 * S3-совместимое хранилище (MinIO / AWS S3 / Cloudflare R2). Переносит сюда
 * прежнюю логику StorageService без изменения поведения.
 */
export class S3StorageProvider implements StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;

  constructor(private readonly cfg: S3ProviderConfig) {
    this.client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: true,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }

  async init() {
    await this.ensureBucket(this.cfg.publicBucket, true);
    await this.ensureBucket(this.cfg.privateBucket, false);
  }

  private async ensureBucket(name: string, isPublic: boolean) {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: name }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: name }));
        if (isPublic) {
          await this.client.send(
            new PutBucketPolicyCommand({
              Bucket: name,
              Policy: JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                  {
                    Effect: 'Allow',
                    Principal: { AWS: ['*'] },
                    Action: ['s3:GetObject'],
                    Resource: [`arn:aws:s3:::${name}/*`],
                  },
                ],
              }),
            }),
          );
        }
        this.logger.log(`Created ${isPublic ? 'public' : 'private'} bucket: ${name}`);
      } catch (e) {
        this.logger.warn(`Bucket setup skipped for ${name}: ${(e as Error).message}`);
      }
    }
  }

  async uploadBuffer(
    key: string,
    body: Buffer,
    contentType: string,
    kind: BucketKind = 'public',
  ): Promise<UploadResult> {
    const bucket = kind === 'private' ? this.cfg.privateBucket : this.cfg.publicBucket;
    await this.client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
    );
    const url = kind === 'public' ? this.publicUrl(bucket, key) : await this.signed(bucket, key);
    return { key, url, kind };
  }

  private publicUrl(bucket: string, key: string): string {
    return `${this.cfg.endpoint.replace(/\/+$/, '')}/${bucket}/${key}`;
  }

  private signed(bucket: string, key: string, ttl = 3600): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: ttl,
    });
  }

  async resolveUrl(storedUrl: string, ttlSeconds = 3600): Promise<string> {
    try {
      const u = new URL(storedUrl);
      const [, bucket, ...rest] = u.pathname.split('/');
      if (!bucket || rest.length === 0) return storedUrl;
      if (bucket === this.cfg.publicBucket) return storedUrl;
      return await this.signed(bucket, rest.join('/'), ttlSeconds);
    } catch {
      return storedUrl;
    }
  }
}
