import { apiRequest } from './client';
import type {
  CompleteWorkoutSessionRequest,
  StartWorkoutSessionRequest,
  ToggleWorkoutSetRequest,
  UpdateWorkoutExerciseProgressRequest,
  WorkoutSessionResponse
} from '@/types/api';

export function startWorkoutSession(body: StartWorkoutSessionRequest) {
  return apiRequest<WorkoutSessionResponse>('/workout-sessions', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function getWorkoutSessionByPlan(dailyPlanId: string) {
  return apiRequest<WorkoutSessionResponse | null>(`/workout-sessions/by-plan/${dailyPlanId}`);
}

export function getWorkoutSession(sessionId: string) {
  return apiRequest<WorkoutSessionResponse>(`/workout-sessions/${sessionId}`);
}

export function toggleWorkoutSet(
  sessionId: string,
  progressId: string,
  body: ToggleWorkoutSetRequest
) {
  return apiRequest<WorkoutSessionResponse>(`/workout-sessions/${sessionId}/exercises/${progressId}/sets`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}

export function updateWorkoutExerciseProgress(
  sessionId: string,
  progressId: string,
  body: UpdateWorkoutExerciseProgressRequest
) {
  return apiRequest<WorkoutSessionResponse>(`/workout-sessions/${sessionId}/exercises/${progressId}`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}

export function completeWorkoutSession(
  sessionId: string,
  body: CompleteWorkoutSessionRequest
) {
  return apiRequest<WorkoutSessionResponse>(`/workout-sessions/${sessionId}/complete`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}
