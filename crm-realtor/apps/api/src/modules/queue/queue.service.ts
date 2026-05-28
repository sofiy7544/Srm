import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job, QueueOptions } from 'bullmq';
import IORedis, { Redis } from 'ioredis';

export type JobType = 'lead.welcome' | 'lead.followup';

export interface JobPayload {
  'lead.welcome': { leadId: string };
  'lead.followup': { leadId: string; days: number };
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private connection: Redis | null = null;
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private handlers = new Map<JobType, (data: unknown) => Promise<void>>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379';
    try {
      this.connection = new IORedis(url, { maxRetriesPerRequest: null });
      const opts: QueueOptions = { connection: this.connection };
      this.queue = new Queue('crm-automation', opts);

      this.worker = new Worker(
        'crm-automation',
        async (job: Job) => {
          const handler = this.handlers.get(job.name as JobType);
          if (!handler) {
            this.logger.warn(`No handler for job ${job.name}`);
            return;
          }
          await handler(job.data);
        },
        { connection: this.connection },
      );

      this.worker.on('failed', (job, err) => {
        this.logger.error(`Job ${job?.name} failed: ${err.message}`);
      });
      this.logger.log('Queue initialized');
    } catch (e) {
      this.logger.warn(`Queue unavailable: ${(e as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    this.connection?.disconnect();
  }

  register<T extends JobType>(type: T, handler: (data: JobPayload[T]) => Promise<void>) {
    this.handlers.set(type, handler as (data: unknown) => Promise<void>);
  }

  async enqueue<T extends JobType>(
    type: T,
    data: JobPayload[T],
    options?: { delayMs?: number; jobId?: string },
  ): Promise<boolean> {
    if (!this.queue) {
      this.logger.warn(`Queue not ready — dropping job ${type}`);
      return false;
    }
    await this.queue.add(type, data, {
      delay: options?.delayMs,
      jobId: options?.jobId,
      removeOnComplete: 100,
      removeOnFail: 100,
    });
    return true;
  }
}
