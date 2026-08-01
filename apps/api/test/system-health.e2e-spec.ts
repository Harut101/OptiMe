import request from 'supertest';

import { createTestApp, TestApp } from './helpers/test-app';

describe('System health', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('exposes a public liveness probe', async () => {
    await request(ctx.app.getHttpServer())
      .get('/v1/system/health/live')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('exposes a public PostgreSQL readiness probe', async () => {
    await request(ctx.app.getHttpServer())
      .get('/v1/system/health/ready')
      .expect(200)
      .expect({
        status: 'ready',
        checks: { database: 'up' }
      });
  });
});
