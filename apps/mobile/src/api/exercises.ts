import type { ExerciseDetail, ExerciseListResponse } from '@optime/shared-types';

import { apiRequest } from './client';

export function getExerciseSummaries(ids: string[]) {
  const uniqueIds = [...new Set(ids)].slice(0, 16);
  const params = new URLSearchParams({ ids: uniqueIds.join(','), pageSize: String(uniqueIds.length || 1) });
  return apiRequest<ExerciseListResponse>(`/exercises?${params.toString()}`);
}

export function getExerciseDetail(exerciseId: string) {
  return apiRequest<ExerciseDetail>(`/exercises/${encodeURIComponent(exerciseId)}`);
}
