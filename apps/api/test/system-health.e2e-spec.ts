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
    const first = await request(ctx.app.getHttpServer())
      .get('/v1/system/health/live')
      .expect(200);
    const second = await request(ctx.app.getHttpServer())
      .get('/v1/system/health/live')
      .expect(200);

    expect(first.body).toEqual({ status: 'ok' });
    expect(first.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(second.headers['x-request-id']).not.toBe(
      first.headers['x-request-id']
    );
  });

  it('correlates unmatched routes without changing their error contract', async () => {
    const response = await request(ctx.app.getHttpServer())
      .get('/v1/not-a-real-route')
      .expect(404);

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Cannot GET /v1/not-a-real-route'
    });
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
