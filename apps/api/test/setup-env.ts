const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for e2e tests. Refusing to run cleanup against DATABASE_URL.'
  );
}

if (!testDatabaseUrl.includes('/optime_test')) {
  throw new Error('TEST_DATABASE_URL must point to the optime_test database.');
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl;
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1d';
process.env.API_PREFIX = process.env.API_PREFIX ?? 'v1';
process.env.EMAIL_PROVIDER = 'development';
process.env.AUTH_DEV_CODE = '123456';
process.env.AUTH_CODE_SECRET = 'test-auth-code-secret';
process.env.AUTH_RATE_LIMIT_ENABLED = 'false';

// Explicit sentinels prevent local real-provider .env values from being loaded
// before AppModule config is initialized. Individual tests may override them.
process.env.AI_PROVIDER = 'mock';
process.env.SAFETY_AGENT_ENABLED = 'false';
process.env.SAFETY_AGENT_PROVIDER = 'mock';
process.env.OPENAI_API_KEY = '';
process.env.OPENAI_DEFAULT_MODEL = '';
process.env.OPENAI_DAILY_PLAN_MODEL_FREE = '';
process.env.OPENAI_DAILY_PLAN_MODEL_PLUS = '';
process.env.OPENAI_DAILY_PLAN_MODEL_PRO = '';
process.env.OPENAI_MODEL_LUNA = '';
process.env.OPENAI_MODEL_TERRA = '';
process.env.OPENAI_MODEL_SOL = '';
