const { spawnSync } = require('node:child_process');

const jestBin = require.resolve('jest/bin/jest');
const env = {
  ...process.env,
  NODE_ENV: 'test',
  AI_PROVIDER: 'mock',
  SAFETY_AGENT_ENABLED: 'false',
  SAFETY_AGENT_PROVIDER: 'mock',
  OPENAI_API_KEY: '',
  OPENAI_DEFAULT_MODEL: '',
  OPENAI_DAILY_PLAN_MODEL_FREE: '',
  OPENAI_DAILY_PLAN_MODEL_PLUS: '',
  OPENAI_DAILY_PLAN_MODEL_PRO: '',
  OPENAI_MODEL_LUNA: '',
  OPENAI_MODEL_TERRA: '',
  OPENAI_MODEL_SOL: ''
};

const result = spawnSync(
  process.execPath,
  [
    jestBin,
    '--config',
    './test/jest-e2e.json',
    '--runInBand',
    ...process.argv.slice(2)
  ],
  { env, stdio: 'inherit' }
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
