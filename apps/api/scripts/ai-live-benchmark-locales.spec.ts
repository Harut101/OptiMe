import {
  benchmarkLocaleSlug,
  configuredBenchmarkLocales
} from './ai-live-benchmark-locales';

describe('AI live benchmark locale configuration', () => {
  it('defaults to en-US so real-call volume does not expand implicitly', () => {
    expect(configuredBenchmarkLocales(undefined)).toEqual(['en-US']);
  });

  it('accepts supported locales and removes duplicates', () => {
    expect(
      configuredBenchmarkLocales('en-US, ru-RU,fr-FR,ru-RU,zh-CN')
    ).toEqual(['en-US', 'ru-RU', 'fr-FR', 'zh-CN']);
  });

  it('rejects unsupported locale values before any provider request', () => {
    expect(() => configuredBenchmarkLocales('en-US,de-DE')).toThrow(
      'AI_BENCHMARK_LOCALES must contain only en-US, ru-RU, fr-FR, zh-CN. Invalid: de-DE.'
    );
  });

  it('creates an email-safe locale slug', () => {
    expect(benchmarkLocaleSlug('zh-CN')).toBe('zh-cn');
  });
});
