import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger
} from '@nestjs/common';
import type { Response } from 'express';

@Catch(HttpException)
export class HealthExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HealthExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<{ method?: string; url?: string }>();
    const status = exception.getStatus();
    const body = exception.getResponse();

    if (exception instanceof BadRequestException && request.url?.includes('/health/wearable-snapshots')) {
      this.logger.warn(
        `wearable snapshot validation failed; method=${request.method}; status=${status}; reason=${this.getSafeReason(body)}`
      );
    }

    response.status(status).json(body);
  }

  private getSafeReason(body: string | object) {
    if (typeof body === 'string') {
      return body.slice(0, 120);
    }

    if ('code' in body && typeof body.code === 'string') {
      return body.code.slice(0, 120);
    }

    if ('message' in body) {
      const message = body.message;
      if (Array.isArray(message)) {
        return `${message.length}_validation_errors`;
      }

      if (typeof message === 'string') {
        return message.slice(0, 120);
      }
    }

    return 'unknown_validation_error';
  }
}

