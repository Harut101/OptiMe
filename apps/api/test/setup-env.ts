const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for e2e tests. Refusing to run cleanup against DATABASE_URL.'
  );
}

if (!testDatabaseUrl.includes('/optime_test')) {
  throw new Error('TEST_DATABASE_URL must point to the optime_test database.');
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1d';
process.env.API_PREFIX = process.env.API_PREFIX ?? 'v1';
