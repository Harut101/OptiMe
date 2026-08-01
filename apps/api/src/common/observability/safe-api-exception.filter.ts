import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import type { Response } from 'express';

import type { CorrelatedRequest } from './request-correlation.middleware';

@Catch()
export class SafeApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<CorrelatedRequest>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const entry = [
        'API request failed',
        `requestId=${request.requestId ?? 'missing'}`,
        `method=${request.method ?? 'unknown'}`,
        `route=${this.getSafeRoute(request)}`,
        `status=${status}`,
        `type=${this.getSafeExceptionType(exception)}`
      ].join('; ');

      if (status === HttpStatus.SERVICE_UNAVAILABLE) {
        this.logger.warn(entry);
      } else {
        this.logger.error(entry);
      }
    }

    if (response.headersSent) return;

    response.status(status).json(this.getSafeResponse(exception, status));
  }

  private getSafeResponse(exception: unknown, status: number) {
    if (!(exception instanceof HttpException)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error'
      };
    }

    const body = exception.getResponse();

    return typeof body === 'string'
      ? { statusCode: status, message: body }
      : body;
  }

  private getSafeRoute(request: CorrelatedRequest) {
    return typeof request.route?.path === 'string'
      ? request.route.path.slice(0, 120)
      : 'unmatched';
  }

  private getSafeExceptionType(exception: unknown) {
    if (!(exception instanceof Error)) return 'UnknownError';

    return /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(exception.name)
      ? exception.name
      : 'Error';
  }
}
