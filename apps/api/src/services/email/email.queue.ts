import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job, QueueOptions } from 'bullmq';
import IORedis, { Redis } from 'ioredis';
import { EmailConfig } from './email.config';
import { EmailTemplateName, SendEmailResult } from './types/email.types';

export interface EmailJobData {
  to: string;
  template: EmailTemplateName;
  variables: Record<string, unknown>;
  subject?: string;
  replyTo?: string;
  metadata?: Record<string, unknown>;
  logId: string;
}

export type EmailJobHandler = (data: EmailJobData) => Promise<SendEmailResult>;

const QUEUE_NAME = 'crm-email';

/**
 * Dedicated BullMQ queue + worker for transactional email.
 * Kept separate from `crm-automation` so email throughput/errors
 * don't affect other background jobs.
 *
 * Falls back to no-op (logs warning) if Redis is unavailable —
 * the EmailService will then send synchronously.
 */
@Injectable()
export class EmailQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailQueueService.name);
  private connection: Redis | null = null;
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private handler: EmailJobHandler | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly emailConfig: EmailConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379';
    try {
      this.connection = new IORedis(url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
      const opts: QueueOptions = { connection: this.connection };
      this.queue = new Queue(QUEUE_NAME, opts);

      this.worker = new Worker<EmailJobData>(
        QUEUE_NAME,
        async (job: Job<EmailJobData>) => {
          if (!this.handler) {
            throw new Error('Email job handler not registered');
          }
          const result = await this.handler(job.data);
          if (!result.ok) {
            throw new Error(result.error ?? 'Unknown email send failure');
          }
          return result;
        },
        {
          connection: this.connection,
          concurrency: 5,
        },
      );

      this.worker.on('failed', (job, err) => {
        this.logger.error(
          `Email job ${job?.id ?? '?'} (${job?.data.template ?? '?'}) failed: ${err.message}`,
        );
      });
      this.worker.on('completed', (job) => {
        this.logger.debug(
          `Email job ${job.id} (${job.data.template}) completed`,
        );
      });

      this.logger.log('Email queue ready');
    } catch (e) {
      this.logger.warn(
        `Email queue unavailable, will send synchronously: ${(e as Error).message}`,
      );
      await this.cleanup();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.cleanup();
  }

  registerHandler(handler: EmailJobHandler): void {
    this.handler = handler;
  }

  isReady(): boolean {
    return this.queue !== null;
  }

  async enqueue(data: EmailJobData): Promise<boolean> {
    if (!this.queue) return false;
    await this.queue.add('send', data, {
      attempts: this.emailConfig.maxAttempts,
      backoff: { type: 'exponential', delay: this.emailConfig.backoffMs },
      removeOnComplete: { count: 500, age: 24 * 60 * 60 },
      removeOnFail: { count: 1000 },
    });
    return true;
  }

  private async cleanup(): Promise<void> {
    try {
      await this.worker?.close();
    } catch (e) {
      this.logger.debug(`Worker close error: ${(e as Error).message}`);
    }
    try {
      await this.queue?.close();
    } catch (e) {
      this.logger.debug(`Queue close error: ${(e as Error).message}`);
    }
    this.connection?.disconnect();
    this.worker = null;
    this.queue = null;
    this.connection = null;
  }
}
