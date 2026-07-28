import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';

export async function registerTestUser(app: INestApplication, email = uniqueEmail()) {
  await request(app.getHttpServer())
    .post('/v1/auth/register')
    .send({
      email,
      password: 'password123',
      timezone: 'UTC',
      locale: 'en-US',
      privacyConsentAccepted: true
    })
    .expect(201);

  const prisma = app.get(PrismaService);
  await prisma.user.update({
    where: { email },
    data: { emailVerifiedAt: new Date() }
  });
  const response = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ email, password: 'password123' })
    .expect(201);

  return {
    email,
    accessToken: response.body.accessToken as string,
    user: response.body.user
  };
}

export function authHeader(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`
  };
}

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}
