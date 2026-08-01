import {
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { RequestCorrelationMiddleware } from './request-correlation.middleware';
import { SafeApiExceptionFilter } from './safe-api-exception.filter';

@Global()
@Module({
  providers: [
    RequestCorrelationMiddleware,
    {
      provide: APP_FILTER,
      useClass: SafeApiExceptionFilter
    }
  ]
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestCorrelationMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL
    });
  }
}
