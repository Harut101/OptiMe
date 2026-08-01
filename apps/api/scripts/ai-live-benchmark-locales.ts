export const SUPPORTED_BENCHMARK_LOCALES = [
  'en-US',
  'ru-RU',
  'fr-FR',
  'zh-CN'
] as const;

export type BenchmarkLocale = (typeof SUPPORTED_BENCHMARK_LOCALES)[number];

export function configuredBenchmarkLocales(
  raw = process.env.AI_BENCHMARK_LOCALES
): BenchmarkLocale[] {
  if (!raw?.trim()) return ['en-US'];

  const locales = [...new Set(raw.split(',').map((value) => value.trim()))];
  const invalid = locales.filter(
    (value) => !SUPPORTED_BENCHMARK_LOCALES.includes(value as BenchmarkLocale)
  );
  if (locales.length === 0 || invalid.length > 0) {
    throw new Error(
      `AI_BENCHMARK_LOCALES must contain only ${SUPPORTED_BENCHMARK_LOCALES.join(', ')}. Invalid: ${invalid.join(', ') || 'empty'}.`
    );
  }

  return locales as BenchmarkLocale[];
}

export function benchmarkLocaleSlug(locale: BenchmarkLocale) {
  return locale.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
