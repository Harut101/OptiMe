import { HttpException, HttpStatus } from '@nestjs/common';

export class BillingProviderError extends HttpException {
  constructor(
    public readonly safeCode: string,
    status: HttpStatus,
    message: string
  ) {
    super({ code: safeCode, message }, status);
  }
}
