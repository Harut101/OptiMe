import request from 'supertest';
import { INestApplication } from '@nestjs/common';

export async function registerTestUser(app: INestApplication, email = uniqueEmail()) {
  const response = await request(app.getHttpServer())
    .post('/v1/auth/register')
    .send({
      email,
      password: 'password123',
      timezone: 'UTC',
      locale: 'en-US',
      privacyConsentAccepted: true
    })
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
