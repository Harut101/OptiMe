import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AiModelRoutingModule } from '../ai-model-routing/ai-model-routing.module';
import { AiOperationLogsModule } from '../ai-operation-logs/ai-operation-logs.module';
import { AI_PROVIDER } from './ai-provider.token';
import { MockAiProviderService } from './mock-ai-provider.service';
import {
  createOpenAiClientFactory,
  OPENAI_CLIENT_FACTORY
} from './open-ai-client.factory';
import { OpenAiProviderService } from './open-ai-provider.service';

@Module({
  imports: [AiModelRoutingModule, AiOperationLogsModule],
  providers: [
    {
      provide: OPENAI_CLIENT_FACTORY,
      inject: [ConfigService],
      useFactory: createOpenAiClientFactory
    },
    MockAiProviderService,
    OpenAiProviderService,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService, MockAiProviderService, OpenAiProviderService],
      useFactory: (
        configService: ConfigService,
        mockAiProvider: MockAiProviderService,
        openAiProvider: OpenAiProviderService
      ) => {
        const logger = new Logger('AiModule');
        const provider = configService.get<string>('AI_PROVIDER', 'mock').toLowerCase();

        if (provider === 'mock') {
          logger.log('selected provider: mock');
          return mockAiProvider;
        }

        if (provider === 'openai') {
          const apiKey = configService.get<string>('OPENAI_API_KEY');
          const defaultModel = configService.get<string>('OPENAI_DEFAULT_MODEL');

          if (!apiKey) {
            throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai.');
          }

          if (!defaultModel) {
            throw new Error('OPENAI_DEFAULT_MODEL is required when AI_PROVIDER=openai.');
          }

          logger.log('selected provider: openai');
          return openAiProvider;
        }

        throw new Error('AI_PROVIDER must be either "mock" or "openai".');
      }
    }
  ],
  exports: [
    AI_PROVIDER,
    OPENAI_CLIENT_FACTORY,
    AiModelRoutingModule,
    AiOperationLogsModule
  ]
})
export class AiModule {}
