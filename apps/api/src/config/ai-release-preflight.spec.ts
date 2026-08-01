import { buildAiReleasePreflight } from './ai-release-preflight';

const releaseEnvironment: NodeJS.ProcessEnv = {
  EXERCISE_MEDIA_PUBLIC_BASE_URL: 'https://media.example.com',
  DATABASE_URL: 'postgresql://example.invalid/optime',
  JWT_SECRET: 'jwt-secret-that-is-long-enough-for-production',
  AUTH_CODE_SECRET: 'auth-code-secret-that-is-long-and-separate',
  CORS_ALLOWED_ORIGINS: 'https://app.example.com',
  TRUST_PROXY_HOPS: '1',
  AUTH_RATE_LIMIT_ENABLED: 'true',
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: ['re', 'unit-test-key-that-is-long-enough'].join('_'),
  EMAIL_FROM: 'OptiMe <hello@example.com>',
  EMAIL_REQUEST_TIMEOUT_MS: '10000',
  SUPPORT_EMAIL: 'support@example.com',
  AI_PROVIDER: 'openai',
  OPENAI_API_KEY: 'unit-test-openai-key-that-is-long-enough',
  OPENAI_DAILY_PLAN_MODEL_FREE: 'free-model',
  OPENAI_DAILY_PLAN_MODEL_PLUS: 'plus-model',
  OPENAI_DAILY_PLAN_MODEL_PRO: 'pro-model',
  OPENAI_DAILY_PLAN_FREE_INPUT_COST_PER_1M_USD: '0.25',
  OPENAI_DAILY_PLAN_FREE_OUTPUT_COST_PER_1M_USD: '2',
  OPENAI_DAILY_PLAN_PLUS_INPUT_COST_PER_1M_USD: '2',
  OPENAI_DAILY_PLAN_PLUS_OUTPUT_COST_PER_1M_USD: '12',
  OPENAI_DAILY_PLAN_PRO_INPUT_COST_PER_1M_USD: '2',
  OPENAI_DAILY_PLAN_PRO_OUTPUT_COST_PER_1M_USD: '12',
  SAFETY_AGENT_ENABLED: 'true',
  SAFETY_AGENT_PROVIDER: 'openai',
  AI_COST_CEILING_ENFORCEMENT_ENABLED: 'true',
  AI_MONTHLY_COST_CEILING_FREE_USD: '1.50',
  AI_MONTHLY_COST_CEILING_PLUS_USD: '4',
  AI_MONTHLY_COST_CEILING_PRO_USD: '8',
  AI_COST_REPORT_DAYS: '30',
  AI_COST_MIN_TIER_SAMPLES: '30',
  AI_COST_MIN_PRICED_COVERAGE_PERCENT: '95',
  AI_STOREFRONT_COMMISSION_PERCENT: '20',
  AI_MEDIAN_COST_MAX_PERCENT_NET: '15',
  AI_P95_COST_MAX_PERCENT_NET: '25',
  AI_PRICE_PLUS_MONTHLY_USD: '19.99',
  AI_PRICE_PRO_MONTHLY_USD: '39.99',
  AI_QUALITY_MIN_TIER_SAMPLES: '30',
  AI_QUALITY_MIN_TELEMETRY_COVERAGE_PERCENT: '95',
  AI_QUALITY_MIN_READY_RATE_PERCENT: '98',
  AI_QUALITY_MAX_FALLBACK_RATE_PERCENT: '2',
  AI_QUALITY_MAX_RETRY_RATE_PERCENT: '25',
};

describe('AI release preflight', () => {
  it('reports safe production routing, economics, and quality configuration', () => {
    const report = buildAiReleasePreflight(releaseEnvironment);

    expect(report).toMatchObject({
      status: 'PASS',
      validatedEnvironment: 'production',
      aiProvider: 'openai',
      openAiApiKeyConfigured: true,
      routes: [
        { tier: 'FREE', model: 'free-model', monthlyCostCeilingUsd: 1.5 },
        { tier: 'PLUS', model: 'plus-model', monthlyCostCeilingUsd: 4 },
        { tier: 'PRO', model: 'pro-model', monthlyCostCeilingUsd: 8 },
      ],
      safetyAgent: { enabled: true, provider: 'openai' },
      costControl: { enabled: true, reportDays: 30 },
      nextRequiredGate: 'ai-release:gate',
    });
  });

  it('never exposes configured secrets in the report', () => {
    const serialized = JSON.stringify(
      buildAiReleasePreflight(releaseEnvironment),
    );

    expect(serialized).not.toContain(releaseEnvironment.OPENAI_API_KEY);
    expect(serialized).not.toContain(releaseEnvironment.JWT_SECRET);
    expect(serialized).not.toContain(releaseEnvironment.AUTH_CODE_SECRET);
    expect(serialized).not.toContain(releaseEnvironment.RESEND_API_KEY);
  });

  it('fails before reporting an incomplete production profile', () => {
    expect(() =>
      buildAiReleasePreflight({
        ...releaseEnvironment,
        AI_MONTHLY_COST_CEILING_FREE_USD: '',
      }),
    ).toThrow('AI_MONTHLY_COST_CEILING_FREE_USD is required in production');
  });
});
