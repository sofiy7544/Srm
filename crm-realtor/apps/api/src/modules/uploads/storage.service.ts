import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export type BucketKind = 'public' | 'private';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: S3Client;
  private publicBucket!: string;
  private privateBucket!: string;
  private publicEndpoint!: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.publicBucket =
      this.config.get<string>('MINIO_PUBLIC_BUCKET') ??
      this.config.get<string>('MINIO_BUCKET') ??
      'crm-public';
    this.privateBucket = this.config.get<string>('MINIO_PRIVATE_BUCKET', 'crm-private');
    this.publicEndpoint = this.config.get<string>('MINIO_ENDPOINT', 'http://localhost:9000');

    this.client = new S3Client({
      endpoint: this.publicEndpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.get<string>('MINIO_ROOT_USER', 'minioadmin'),
        secretAccessKey: this.config.get<string>('MINIO_ROOT_PASSWORD', 'minioadmin_dev'),
      },
    });

    await this.ensureBucket(this.publicBucket, true);
    await this.ensureBucket(this.privateBucket, false);
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

  buildKey(prefix: string, originalName: string): string {
    const ext = originalName.includes('.') ? originalName.split('.').pop() : 'bin';
    return `${prefix}/${randomUUID()}.${ext}`;
  }

  async uploadBuffer(
    key: string,
    body: Buffer,
    contentType: string,
    kind: BucketKind = 'public',
  ): Promise<{ key: string; url: string; bucket: string; kind: BucketKind }> {
    const bucket = kind === 'private' ? this.privateBucket : this.publicBucket;
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    const url =
      kind === 'public'
        ? this.publicUrl(bucket, key)
        : await this.signedDownloadUrl(bucket, key);
    return { key, url, bucket, kind };
  }

  publicUrl(bucket: string, key: string): string {
    return `${this.publicEndpoint}/${bucket}/${key}`;
  }

  async signedDownloadUrl(bucket: string, key: string, ttlSeconds = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
  }

  async signedUrlFromStoredUrl(storedUrl: string, ttlSeconds = 3600): Promise<string> {
    try {
      const u = new URL(storedUrl);
      const [, bucket, ...rest] = u.pathname.split('/');
      if (!bucket || rest.length === 0) return storedUrl;
      if (bucket === this.publicBucket) return storedUrl;
      const key = rest.join('/');
      return await this.signedDownloadUrl(bucket, key, ttlSeconds);
    } catch {
      return storedUrl;
    }
  }
}
