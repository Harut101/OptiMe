import { parseBoolean, parseCsv, parseInteger, validateEnvironment } from './environment.validation';

const productionEnvironment = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://optime:optime@db:5432/optime?schema=public',
  JWT_SECRET: 'jwt-secret-that-is-long-enough-for-production',
  AUTH_CODE_SECRET: 'auth-code-secret-that-is-long-and-separate',
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_test_key',
  EMAIL_FROM: 'OptiMe <hello@example.com>',
  CORS_ALLOWED_ORIGINS: 'https://app.example.com',
  TRUST_PROXY_HOPS: '1',
  AUTH_RATE_LIMIT_ENABLED: 'true'
};

describe('environment validation', () => {
  it('accepts a complete production environment', () => {
    expect(validateEnvironment({ ...productionEnvironment })).toEqual(productionEnvironment);
  });

  it('rejects placeholder or shared production secrets', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        JWT_SECRET: 'replace-with-a-long-random-secret'
      })
    ).toThrow('JWT_SECRET must be a non-placeholder secret');

    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        AUTH_CODE_SECRET: productionEnvironment.JWT_SECRET
      })
    ).toThrow('AUTH_CODE_SECRET must be different from JWT_SECRET');
  });

  it('requires an explicit production CORS allowlist', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        CORS_ALLOWED_ORIGINS: '*'
      })
    ).toThrow('CORS_ALLOWED_ORIGINS must contain an explicit production origin allowlist');
  });

  it('parses safe shared config values', () => {
    expect(parseCsv('https://one.example, https://two.example')).toEqual([
      'https://one.example',
      'https://two.example'
    ]);
    expect(parseBoolean('false', 'FLAG')).toBe(false);
    expect(parseInteger('2', 'COUNT', 0, 3)).toBe(2);
  });
});
