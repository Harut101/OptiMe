import { resolveOpenAiOutputTokenBudget } from './open-ai-output-token-budget';

describe('resolveOpenAiOutputTokenBudget', () => {
  it('prefers the operation-specific output limit', () => {
    const config = createConfig({
      OPENAI_MAX_OUTPUT_TOKENS: '4000',
      OPENAI_SAFETY_MAX_OUTPUT_TOKENS: '1200'
    });

    expect(
      resolveOpenAiOutputTokenBudget(
        config,
        'OPENAI_SAFETY_MAX_OUTPUT_TOKENS',
        4000
      )
    ).toBe(1200);
  });

  it('falls back to the legacy global output limit', () => {
    const config = createConfig({
      OPENAI_MAX_OUTPUT_TOKENS: '3600'
    });

    expect(
      resolveOpenAiOutputTokenBudget(
        config,
        'OPENAI_NUTRITION_MAX_OUTPUT_TOKENS',
        4000
      )
    ).toBe(3600);
  });
});

function createConfig(values: Record<string, string>) {
  return {
    get: jest.fn((key: string) => values[key])
  };
}
