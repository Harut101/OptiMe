import type { ConfigService } from '@nestjs/config';

type OutputTokenConfig = Pick<ConfigService, 'get'>;

export function resolveOpenAiOutputTokenBudget(
  configService: OutputTokenConfig,
  operationKey: string,
  fallback: number
) {
  const globalLimit = readPositiveInteger(
    configService,
    'OPENAI_MAX_OUTPUT_TOKENS',
    fallback
  );

  return readPositiveInteger(
    configService,
    operationKey,
    globalLimit
  );
}

function readPositiveInteger(
  configService: OutputTokenConfig,
  key: string,
  fallback: number
) {
  const value = Number(configService.get<string>(key));
  return Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : fallback;
}
