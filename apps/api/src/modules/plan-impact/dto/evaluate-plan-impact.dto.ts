import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength
} from 'class-validator';

export const PLAN_IMPACT_CHANGE_TYPES = [
  'PROFILE_WEIGHT_CHANGED',
  'PROFILE_HEIGHT_CHANGED',
  'ACTIVITY_LEVEL_CHANGED',
  'PRIMARY_GOAL_CHANGED',
  'APP_MODE_CHANGED',
  'FOOD_PREFERENCES_CHANGED',
  'ALLERGY_CHANGED',
  'EXCLUDED_FOOD_CHANGED',
  'DISLIKED_FOOD_CHANGED',
  'MEAL_COUNT_CHANGED',
  'TRAINING_ROUTINE_CHANGED',
  'DAILY_TRAINING_OVERRIDE_CHANGED',
  'TRAINING_DURATION_CHANGED',
  'TRAINING_EQUIPMENT_CHANGED',
  'TRAINING_MUSCLES_CHANGED',
  'APPLE_HEALTH_SYNCED',
  'WEARABLE_SNAPSHOT_CHANGED',
  'PRE_WORKOUT_PAIN_LIMITATION',
  'PAIN_AWARE_REPLACEMENT_APPLIED'
] as const;

export type PlanImpactChangeTypeDto = (typeof PLAN_IMPACT_CHANGE_TYPES)[number];

export class EvaluatePlanImpactDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsIn(PLAN_IMPACT_CHANGE_TYPES, { each: true })
  changeTypes!: PlanImpactChangeTypeDto[];

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  localDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  changedFields?: string[];

  @IsOptional()
  @IsObject()
  newValues?: Record<string, unknown>;
}
