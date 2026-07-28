import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

import { WhoopError, WhoopErrorCode } from './whoop.error';

@Catch(WhoopError)
export class WhoopExceptionFilter implements ExceptionFilter {
  catch(exception: WhoopError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = this.getStatus(exception.code);

    response.status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message
    });
  }

  private getStatus(code: WhoopErrorCode) {
    switch (code) {
      case 'WHOOP_OAUTH_STATE_INVALID':
      case 'WHOOP_AUTHORIZATION_DENIED':
      case 'WHOOP_TOKEN_EXCHANGE_FAILED':
      case 'WHOOP_TOKEN_RESPONSE_INVALID':
      case 'WHOOP_REQUIRED_SCOPES_MISSING':
      case 'WHOOP_REVOCATION_FAILED':
        return HttpStatus.BAD_REQUEST;
      case 'WHOOP_INTEGRATION_DISABLED':
      case 'WHOOP_PROVIDER_UNAVAILABLE':
        return HttpStatus.SERVICE_UNAVAILABLE;
      case 'WHOOP_CONFIG_INVALID':
      case 'WHOOP_TOKEN_DECRYPTION_FAILED':
      case 'WHOOP_CONNECTION_PERSISTENCE_FAILED':
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}
