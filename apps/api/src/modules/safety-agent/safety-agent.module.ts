import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AiModule } from '../ai/ai.module';
import { MockSafetyAgentService } from './mock-safety-agent.service';
import { OpenAiSafetyAgentService } from './open-ai-safety-agent.service';
import { SAFETY_AGENT, SAFETY_AGENT_CONFIG, SafetyAgentConfig } from './safety-agent.token';

@Module({
  imports: [AiModule],
  providers: [
    MockSafetyAgentService,
    OpenAiSafetyAgentService,
    {
      provide: SAFETY_AGENT_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): SafetyAgentConfig => {
        const enabled = configService.get<string>('SAFETY_AGENT_ENABLED') === 'true';
        const provider = configService
          .get<string>('SAFETY_AGENT_PROVIDER', 'mock')
          .toLowerCase();

        if (provider !== 'mock' && provider !== 'openai') {
          throw new Error('SAFETY_AGENT_PROVIDER must be either "mock" or "openai".');
        }

        return {
          enabled,
          provider
        };
      }
    },
    {
      provide: SAFETY_AGENT,
      inject: [ConfigService, MockSafetyAgentService, OpenAiSafetyAgentService],
      useFactory: (
        configService: ConfigService,
        mockSafetyAgent: MockSafetyAgentService,
        openAiSafetyAgent: OpenAiSafetyAgentService
      ) => {
        const enabled = configService.get<string>('SAFETY_AGENT_ENABLED') === 'true';
        const provider = configService
          .get<string>('SAFETY_AGENT_PROVIDER', 'mock')
          .toLowerCase();

        if (!enabled || provider === 'mock') {
          return mockSafetyAgent;
        }

        if (provider === 'openai') {
          const apiKey = configService.get<string>('OPENAI_API_KEY');
          const defaultModel = configService.get<string>('OPENAI_DEFAULT_MODEL');

          if (!apiKey) {
            throw new Error('OPENAI_API_KEY is required when SAFETY_AGENT_PROVIDER=openai.');
          }

          if (!defaultModel) {
            throw new Error('OPENAI_DEFAULT_MODEL is required when SAFETY_AGENT_PROVIDER=openai.');
          }

          return openAiSafetyAgent;
        }

        throw new Error('SAFETY_AGENT_PROVIDER must be either "mock" or "openai".');
      }
    }
  ],
  exports: [SAFETY_AGENT, SAFETY_AGENT_CONFIG]
})
export class SafetyAgentModule {}
