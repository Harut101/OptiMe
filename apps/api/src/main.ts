import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { join } from 'node:path';

import { AppModule } from './app.module';
import { REQUEST_ID_HEADER } from './common/observability/request-correlation.middleware';
import { parseCsv, parseInteger } from './config/environment.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true
  });
  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('API_PREFIX', 'v1');
  const port = config.get<number>('PORT', 3000);
  const trustProxyHops = parseInteger(
    config.get('TRUST_PROXY_HOPS'),
    'TRUST_PROXY_HOPS',
    0,
    10
  );
  const allowedOrigins = parseCsv(config.get('CORS_ALLOWED_ORIGINS'));

  app.setGlobalPrefix(apiPrefix);
  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    exposedHeaders: [REQUEST_ID_HEADER]
  });
  app.useStaticAssets(join(process.cwd(), 'public', 'exercise-media'), {
    prefix: '/exercise-media/',
    index: false,
    maxAge: '1d',
    setHeaders: (res, path) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      if (path.toLowerCase().endsWith('.webp')) res.setHeader('Content-Type', 'image/webp');
      if (path.toLowerCase().endsWith('.jpg') || path.toLowerCase().endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      }
    }
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.enableShutdownHooks();

  await app.listen(port);
}

void bootstrap();
