import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import type { Response } from 'express';

import type { CorrelatedRequest } from './request-correlation.middleware';
import { SafeApiExceptionFilter } from './safe-api-exception.filter';

describe('SafeApiExceptionFilter', () => {
  it('preserves an existing client-error response without error logging', () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { host, status, json } = createHost();
    const body = { code: 'INVALID_REQUEST', message: 'Invalid request.' };

    new SafeApiExceptionFilter().catch(new BadRequestException(body), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(body);
    expect(logger).not.toHaveBeenCalled();
    logger.mockRestore();
  });

  it('returns a generic 500 and logs only bounded correlation metadata', () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { host, status, json } = createHost({
      method: 'POST',
      requestId: '2d63cc50-0d96-43db-b188-d39c68a24f9e',
      originalUrl: '/v1/daily-plans/private-id?token=private-token',
      route: { path: '/daily-plans/:id' }
    });

    new SafeApiExceptionFilter().catch(
      new Error('private-user@example.test failed with private-token'),
      host
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error'
    });
    expect(logger).toHaveBeenCalledTimes(1);

    const log = String(logger.mock.calls[0]?.[0]);
    expect(log).toContain('requestId=2d63cc50-0d96-43db-b188-d39c68a24f9e');
    expect(log).toContain('method=POST');
    expect(log).toContain('route=/daily-plans/:id');
    expect(log).toContain('status=500');
    expect(log).toContain('type=Error');
    expect(log).not.toContain('private-user');
    expect(log).not.toContain('private-token');
    logger.mockRestore();
  });
});

function createHost(requestOverrides: Partial<CorrelatedRequest> = {}) {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  const response = {
    headersSent: false,
    status,
    json
  } as unknown as Response;
  const request = {
    method: 'GET',
    requestId: 'request-id',
    route: { path: '/test' },
    ...requestOverrides
  } as CorrelatedRequest;
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response
    })
  } as ArgumentsHost;

  return { host, status, json };
}
