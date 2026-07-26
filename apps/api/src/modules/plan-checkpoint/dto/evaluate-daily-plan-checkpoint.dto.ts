import { IsIn } from 'class-validator';
import type { PlanCheckpointTrigger } from '@optime/shared-types';

export const PLAN_CHECKPOINT_TRIGGERS = [
  'APP_OPEN',
  'HEALTH_SYNC',
  'PRE_WORKOUT_CHECK',
  'MANUAL_CHECK_IN'
] as const satisfies readonly PlanCheckpointTrigger[];

export class EvaluateDailyPlanCheckpointDto {
  @IsIn(PLAN_CHECKPOINT_TRIGGERS)
  trigger!: PlanCheckpointTrigger;
}
