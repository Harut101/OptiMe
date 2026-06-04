import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

interface TestAppProviderOverride {
  token: unknown;
  value: unknown;
}

interface CreateTestAppOptions {
  providerOverrides?: TestAppProviderOverride[];
}

export async function createTestApp(options: CreateTestAppOptions = {}) {
  const builder = Test.createTestingModule({
    imports: [AppModule]
  });

  for (const override of options.providerOverrides ?? []) {
    builder.overrideProvider(override.token).useValue(override.value);
  }

  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  await app.init();

  return {
    app,
    prisma: app.get(PrismaService)
  };
}

export type TestApp = {
  app: INestApplication;
  prisma: PrismaService;
};
