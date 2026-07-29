import type { BillingErrorCode } from './billing.types';

export class BillingError extends Error {
  constructor(
    public readonly code: BillingErrorCode,
    options?: { cause?: unknown }
  ) {
    super(code, options);
    this.name = 'BillingError';
  }
}
