import { parseBoolean, parseCsv, parseInteger, validateEnvironment } from './environment.validation';

const productionEnvironment = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://optime:optime@db:5432/optime?schema=public',
  EXERCISE_MEDIA_PUBLIC_BASE_URL: 'https://media.example.com',
  JWT_SECRET: 'jwt-secret-that-is-long-enough-for-production',
  AUTH_CODE_SECRET: 'auth-code-secret-that-is-long-and-separate',
  AI_PROVIDER: 'openai',
  OPENAI_API_KEY: 'unit-test-openai-key-that-is-long-enough',
  OPENAI_DAILY_PLAN_MODEL_FREE: 'gpt-free',
  OPENAI_DAILY_PLAN_MODEL_PLUS: 'gpt-plus',
  OPENAI_DAILY_PLAN_MODEL_PRO: 'gpt-pro',
  OPENAI_DAILY_PLAN_FREE_INPUT_COST_PER_1M_USD: '1',
  OPENAI_DAILY_PLAN_FREE_OUTPUT_COST_PER_1M_USD: '6',
  OPENAI_DAILY_PLAN_PLUS_INPUT_COST_PER_1M_USD: '2.5',
  OPENAI_DAILY_PLAN_PLUS_OUTPUT_COST_PER_1M_USD: '15',
  OPENAI_DAILY_PLAN_PRO_INPUT_COST_PER_1M_USD: '2.5',
  OPENAI_DAILY_PLAN_PRO_OUTPUT_COST_PER_1M_USD: '15',
  SAFETY_AGENT_ENABLED: 'true',
  SAFETY_AGENT_PROVIDER: 'openai',
  AI_COST_CEILING_ENFORCEMENT_ENABLED: 'true',
  AI_MONTHLY_COST_CEILING_FREE_USD: '1.50',
  AI_MONTHLY_COST_CEILING_PLUS_USD: '4',
  AI_MONTHLY_COST_CEILING_PRO_USD: '8',
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_test_key_long_enough',
  EMAIL_FROM: 'OptiMe <hello@example.com>',
  SUPPORT_EMAIL: 'support@example.com',
  EMAIL_REQUEST_TIMEOUT_MS: '10000',
  CORS_ALLOWED_ORIGINS: 'https://app.example.com',
  TRUST_PROXY_HOPS: '1',
  AUTH_RATE_LIMIT_ENABLED: 'true'
};

describe('environment validation', () => {
  it('keeps development and test environments independent from production AI requirements', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'development',
        AI_PROVIDER: 'mock'
      })
    ).toEqual({
      NODE_ENV: 'development',
      AI_PROVIDER: 'mock'
    });
  });

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

  it('requires a public HTTPS exercise media origin in production', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        EXERCISE_MEDIA_PUBLIC_BASE_URL: ''
      })
    ).toThrow('EXERCISE_MEDIA_PUBLIC_BASE_URL is required in production');

    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        EXERCISE_MEDIA_PUBLIC_BASE_URL: 'http://localhost:3000'
      })
    ).toThrow('EXERCISE_MEDIA_PUBLIC_BASE_URL must be a public HTTPS URL');

    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        EXERCISE_MEDIA_PUBLIC_BASE_URL: 'https://user:password@media.example.com'
      })
    ).toThrow('EXERCISE_MEDIA_PUBLIC_BASE_URL must be a public HTTPS URL');
  });

  it('requires production email delivery metadata', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        SUPPORT_EMAIL: ''
      })
    ).toThrow('SUPPORT_EMAIL is required in production');

    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        EMAIL_FROM: 'not-an-email'
      })
    ).toThrow('EMAIL_FROM must contain a valid email address');

    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        RESEND_API_KEY: 'placeholder'
      })
    ).toThrow('RESEND_API_KEY must be a non-placeholder Resend API key');
  });

  it('requires tier-routed OpenAI planning and semantic safety in production', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        AI_PROVIDER: 'mock'
      })
    ).toThrow('AI_PROVIDER=openai is required in production');

    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        OPENAI_API_KEY: ''
      })
    ).toThrow('OPENAI_API_KEY is required in production');

    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        OPENAI_DAILY_PLAN_MODEL_PRO: ''
      })
    ).toThrow('OPENAI_DAILY_PLAN_MODEL_PRO is required in production');

    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        SAFETY_AGENT_ENABLED: 'false'
      })
    ).toThrow('SAFETY_AGENT_ENABLED=true is required in production');

    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        SAFETY_AGENT_PROVIDER: 'mock'
      })
    ).toThrow('SAFETY_AGENT_PROVIDER=openai is required in production');
  });

  it('requires production model pricing and monthly cost ceilings', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        OPENAI_DAILY_PLAN_FREE_INPUT_COST_PER_1M_USD: ''
      })
    ).toThrow(
      'OPENAI_DAILY_PLAN_FREE_INPUT_COST_PER_1M_USD is required in production'
    );

    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        OPENAI_DAILY_PLAN_PLUS_OUTPUT_COST_PER_1M_USD: '0'
      })
    ).toThrow(
      'OPENAI_DAILY_PLAN_PLUS_OUTPUT_COST_PER_1M_USD must be a positive number in production'
    );

    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        AI_COST_CEILING_ENFORCEMENT_ENABLED: 'false'
      })
    ).toThrow(
      'AI_COST_CEILING_ENFORCEMENT_ENABLED=true is required in production'
    );

    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        AI_MONTHLY_COST_CEILING_PRO_USD: ''
      })
    ).toThrow('AI_MONTHLY_COST_CEILING_PRO_USD is required in production');
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
