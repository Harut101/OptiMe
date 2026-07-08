import { apiRequest } from './client';
import type {
  EvaluatePlanImpactRequest,
  EvaluatePlanImpactResponse
} from '@/types/api';

export function evaluatePlanImpact(request: EvaluatePlanImpactRequest) {
  return apiRequest<EvaluatePlanImpactResponse>('/plan-impact/evaluate', {
    method: 'POST',
    body: JSON.stringify(request)
  });
}
