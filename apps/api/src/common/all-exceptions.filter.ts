import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Global exception filter — catches everything that wasn't handled
 * by NestJS's default HttpException flow.
 *
 * Goals:
 *   1. Never leak internal stack traces / Prisma error details to the client.
 *   2. Log full details server-side so we can debug.
 *   3. Map well-known Prisma errors to sensible HTTP responses.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProd = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: { message: string; statusCode: number; errors?: unknown; path?: string } = {
      message: 'Internal server error',
      statusCode: status,
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      body = typeof res === 'string' ? { message: res, statusCode: status } : { ...(res as object), statusCode: status } as typeof body;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 — unique constraint violation
      // P2025 — record not found
      // P2003 — foreign key constraint failed
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        body = { statusCode: status, message: 'A record with these values already exists' };
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        body = { statusCode: status, message: 'Resource not found' };
      } else if (exception.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        body = { statusCode: status, message: 'Referenced record does not exist' };
      } else {
        status = HttpStatus.BAD_REQUEST;
        body = { statusCode: status, message: 'Database constraint violation' };
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      body = { statusCode: status, message: 'Invalid request data' };
    }

    // Always log full details server-side
    const stack = exception instanceof Error ? exception.stack : String(exception);
    this.logger.error(
      `${request.method} ${request.url} → ${status} :: ${body.message}`,
      isProd ? undefined : stack,
    );

    // In production — never include stack/path/internal details in response
    if (isProd) {
      response.status(status).json({
        statusCode: status,
        message: body.message,
      });
    } else {
      response.status(status).json({
        ...body,
        path: request.url,
      });
    }
  }
}
