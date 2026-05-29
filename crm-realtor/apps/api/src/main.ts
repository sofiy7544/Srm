import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    rawBody: true,
  });

  const config = app.get(ConfigService);
  // PORT is injected by Render/Railway/Fly; API_PORT used locally
  const port = Number(process.env.PORT ?? config.get<number>('API_PORT', 3001));
  const webOrigin = config.get<string>('WEB_ORIGIN');

  if (isProd && !webOrigin) {
    Logger.warn('WEB_ORIGIN not set — CORS will allow all origins. Set WEB_ORIGIN in production.', 'Bootstrap');
  }

  // true = allow all origins (CorsOptions accepts boolean | string | RegExp | ...)
  const origins: string | string[] | boolean = webOrigin
    ? webOrigin.split(',').map((s) => s.trim())
    : true;
  // Security headers
  app.use((_req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.enableCors({
    origin: origins,
    credentials: typeof origins !== 'boolean',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Catch-all exception filter — never leaks internal details in production,
  // maps Prisma errors to sensible HTTP statuses, logs everything server-side.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Bind 0.0.0.0 — иначе на Railway/Docker сервер слушает только localhost
  // и внешний healthcheck (/api/health) не достучится → деплой падает.
  await app.listen(port, '0.0.0.0');
  Logger.log(`API ready at http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
