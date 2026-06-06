import { apiRequest } from './client';
import type {
  ProgressivePrompt,
  ProgressivePromptAnswerRequest,
  ProgressivePromptAnswerResponse,
  ProgressivePromptSkipResponse
} from '@/types/api';

export function getNextProgressivePrompt() {
  return apiRequest<ProgressivePrompt | null>('/progressive-profile/next-prompt');
}

export function answerProgressivePrompt(key: string, body: ProgressivePromptAnswerRequest) {
  return apiRequest<ProgressivePromptAnswerResponse>(
    `/progressive-profile/prompts/${encodeURIComponent(key)}/answer`,
    {
      method: 'POST',
      body: JSON.stringify(body)
    }
  );
}

export function skipProgressivePrompt(key: string) {
  return apiRequest<ProgressivePromptSkipResponse>(
    `/progressive-profile/prompts/${encodeURIComponent(key)}/skip`,
    {
      method: 'POST'
    }
  );
}
