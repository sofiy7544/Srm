import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let db = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
      uptime: process.uptime(),
      // Маркер версии: позволяет по живому эндпоинту убедиться, какой commit
      // реально задеплоен (Railway прокидывает RAILWAY_GIT_COMMIT_SHA).
      commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? 'unknown',
      // Подтверждает, что запущен код с cross-site cookie-фиксом.
      cookieSameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      timestamp: new Date().toISOString(),
    };
  }
}
