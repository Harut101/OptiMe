export type OpenAiFallbackReason =
  | 'openai_auth_error'
  | 'openai_invalid_model'
  | 'openai_rate_limited'
  | 'openai_bad_request'
  | 'openai_timeout'
  | 'openai_network_error'
  | 'openai_structured_output_request_invalid'
  | 'missing_output_text'
  | 'json_parse_failed'
  | 'schema_validation_failed'
  | 'unknown_openai_error';

export class OpenAiProviderError extends Error {
  readonly originalError?: unknown;
  readonly fallbackReason: OpenAiFallbackReason;

  constructor(
    message: string,
    options: { fallbackReason: OpenAiFallbackReason; cause?: unknown }
  ) {
    super(message);
    this.name = 'OpenAiProviderError';
    this.fallbackReason = options.fallbackReason;
    this.originalError = options.cause;
  }
}
