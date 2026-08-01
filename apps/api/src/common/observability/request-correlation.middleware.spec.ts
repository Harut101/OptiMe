import type { NextFunction, Response } from 'express';

import {
  CorrelatedRequest,
  REQUEST_ID_HEADER,
  RequestCorrelationMiddleware
} from './request-correlation.middleware';

describe('RequestCorrelationMiddleware', () => {
  it('creates a server-owned request ID and returns it in the response header', () => {
    const request = {} as CorrelatedRequest;
    const setHeader = jest.fn();
    const next = jest.fn() as NextFunction;

    new RequestCorrelationMiddleware().use(
      request,
      { setHeader } as unknown as Response,
      next
    );

    expect(request.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      request.requestId
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not trust a caller-supplied request ID', () => {
    const request = {
      headers: { 'x-request-id': 'caller-controlled-value' }
    } as unknown as CorrelatedRequest;

    new RequestCorrelationMiddleware().use(
      request,
      { setHeader: jest.fn() } as unknown as Response,
      jest.fn()
    );

    expect(request.requestId).not.toBe('caller-controlled-value');
  });
});
