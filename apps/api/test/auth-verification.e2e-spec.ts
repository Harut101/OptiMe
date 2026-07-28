import request from 'supertest';

import { authHeader } from './helpers/auth';
import { cleanupDatabase } from './helpers/cleanup';
import { createTestApp, TestApp } from './helpers/test-app';

describe('Email verification and password recovery', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await cleanupDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await cleanupDatabase(ctx.prisma);
    await ctx.app.close();
  });

  it('requires email verification before issuing an authenticated session', async () => {
    const registration = await register('verify@example.com');

    expect(registration.body).toEqual({
      verificationRequired: true,
      email: 'verify@example.com',
      messageCode: 'VERIFICATION_EMAIL_SENT'
    });
    expect(registration.body.accessToken).toBeUndefined();

    const blockedLogin = await request(ctx.app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'verify@example.com', password: 'password123' })
      .expect(403);
    expect(blockedLogin.body.code).toBe('EMAIL_NOT_VERIFIED');

    await request(ctx.app.getHttpServer())
      .post('/v1/auth/verify-email')
      .send({ email: 'verify@example.com', code: '000000' })
      .expect(400);

    const verified = await request(ctx.app.getHttpServer())
      .post('/v1/auth/verify-email')
      .send({ email: 'verify@example.com', code: '123456' })
      .expect(201);

    expect(verified.body.accessToken).toEqual(expect.any(String));
    expect(verified.body.user.email).toBe('verify@example.com');
    await request(ctx.app.getHttpServer())
      .get('/v1/profile')
      .set(authHeader(verified.body.accessToken))
      .expect(200);
  });

  it('rate limits immediate resend without revealing account state', async () => {
    await register('resend@example.com');

    const response = await request(ctx.app.getHttpServer())
      .post('/v1/auth/resend-verification')
      .send({ email: 'resend@example.com' })
      .expect(201);

    expect(response.body).toEqual({ messageCode: 'VERIFICATION_EMAIL_SENT' });
    expect(
      await ctx.prisma.authCode.count({
        where: { user: { email: 'resend@example.com' } }
      })
    ).toBe(1);
  });

  it('returns the same password-reset request response for known and unknown emails', async () => {
    await registerAndVerify('known@example.com');

    const known = await request(ctx.app.getHttpServer())
      .post('/v1/auth/request-password-reset')
      .send({ email: 'known@example.com' })
      .expect(201);
    const knownRepeated = await request(ctx.app.getHttpServer())
      .post('/v1/auth/request-password-reset')
      .send({ email: 'known@example.com' })
      .expect(201);
    const unknown = await request(ctx.app.getHttpServer())
      .post('/v1/auth/request-password-reset')
      .send({ email: 'unknown@example.com' })
      .expect(201);

    expect(known.body).toEqual({ messageCode: 'PASSWORD_RESET_EMAIL_SENT' });
    expect(knownRepeated.body).toEqual(known.body);
    expect(unknown.body).toEqual(known.body);
  });

  it('resets the password and invalidates previously issued JWTs', async () => {
    const session = await registerAndVerify('reset@example.com');

    await request(ctx.app.getHttpServer())
      .post('/v1/auth/request-password-reset')
      .send({ email: 'reset@example.com' })
      .expect(201);
    await request(ctx.app.getHttpServer())
      .post('/v1/auth/reset-password')
      .send({
        email: 'reset@example.com',
        code: '123456',
        newPassword: 'new-password123'
      })
      .expect(201);

    await request(ctx.app.getHttpServer())
      .get('/v1/profile')
      .set(authHeader(session.accessToken))
      .expect(401);
    await request(ctx.app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'reset@example.com', password: 'password123' })
      .expect(401);
    const newSession = await request(ctx.app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'reset@example.com', password: 'new-password123' })
      .expect(201);

    expect(newSession.body.accessToken).toEqual(expect.any(String));
  });

  it('requires the current password and deletes the authenticated account data', async () => {
    const session = await registerAndVerify('delete-account@example.com');
    const user = await ctx.prisma.user.findUniqueOrThrow({
      where: { email: 'delete-account@example.com' }
    });
    await ctx.prisma.weightLog.create({
      data: {
        userId: user.id,
        localDate: '2026-07-29',
        measuredAt: new Date('2026-07-29T08:00:00.000Z'),
        weightKg: 80,
        source: 'MANUAL'
      }
    });

    await request(ctx.app.getHttpServer())
      .delete('/v1/me/account')
      .set(authHeader(session.accessToken))
      .send({ currentPassword: 'wrong-password' })
      .expect(401);
    expect(await ctx.prisma.user.count({ where: { id: user.id } })).toBe(1);

    await request(ctx.app.getHttpServer())
      .delete('/v1/me/account')
      .set(authHeader(session.accessToken))
      .send({ currentPassword: 'password123' })
      .expect(204);

    expect(await ctx.prisma.user.count({ where: { id: user.id } })).toBe(0);
    expect(await ctx.prisma.weightLog.count({ where: { userId: user.id } })).toBe(0);
    expect(await ctx.prisma.authCode.count({ where: { userId: user.id } })).toBe(0);
    await request(ctx.app.getHttpServer())
      .get('/v1/profile')
      .set(authHeader(session.accessToken))
      .expect(401);
  });

  async function register(email: string) {
    return request(ctx.app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email,
        password: 'password123',
        timezone: 'UTC',
        locale: 'en-US',
        privacyConsentAccepted: true
      })
      .expect(201);
  }

  async function registerAndVerify(email: string) {
    await register(email);
    const response = await request(ctx.app.getHttpServer())
      .post('/v1/auth/verify-email')
      .send({ email, code: '123456' })
      .expect(201);

    return {
      accessToken: response.body.accessToken as string
    };
  }
});
