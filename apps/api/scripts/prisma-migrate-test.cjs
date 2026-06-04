const { spawnSync } = require('node:child_process');

if (!process.env.TEST_DATABASE_URL) {
  console.error('TEST_DATABASE_URL is required to migrate the test database.');
  process.exit(1);
}

if (!process.env.TEST_DATABASE_URL.includes('/optime_test')) {
  console.error('TEST_DATABASE_URL must point to the optime_test database.');
  process.exit(1);
}

const result = spawnSync('prisma', ['migrate', 'dev'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: process.env.TEST_DATABASE_URL
  }
});

process.exit(result.status ?? 1);
