import { ConfigService } from '@nestjs/config';

export const OPENAI_CLIENT_FACTORY = Symbol('OPENAI_CLIENT_FACTORY');

export interface OpenAiResponsesClient {
  responses: {
    create(
      input: Record<string, unknown>,
      options?: { timeout?: number }
    ): Promise<OpenAiResponse>;
  };
}

export interface OpenAiResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

export type OpenAiClientFactory = (apiKey: string) => OpenAiResponsesClient;

export function createOpenAiClientFactory(_configService: ConfigService): OpenAiClientFactory {
  return (apiKey: string) => {
    // Lazy require keeps mock mode working before local dependencies are installed.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const requireFn = eval('require') as NodeRequire;
    const OpenAI = requireFn('openai');
    const OpenAIClient = OpenAI.default ?? OpenAI;

    return new OpenAIClient({ apiKey }) as OpenAiResponsesClient;
  };
}
