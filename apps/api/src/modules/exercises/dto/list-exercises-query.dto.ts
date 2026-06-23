import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  EXERCISE_CATEGORIES,
  EXERCISE_EQUIPMENT,
  MOVEMENT_PATTERNS,
  TARGET_MUSCLE_GROUPS,
  TRAINING_LEVELS,
  type ExerciseCategory,
  type ExerciseEquipment,
  type MovementPattern,
  type TargetMuscleGroup,
  type TrainingLevel
} from '@optime/shared-types';

export class ListExercisesQueryDto {
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string'
    ? value.split(',').map((item) => item.trim()).filter(Boolean)
    : value)
  @IsArray()
  @ArrayMaxSize(16)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  ids?: string[];

  @IsOptional()
  @IsIn(EXERCISE_CATEGORIES)
  category?: ExerciseCategory;

  @IsOptional()
  @IsIn(EXERCISE_EQUIPMENT)
  equipment?: ExerciseEquipment;

  @IsOptional()
  @IsIn(TARGET_MUSCLE_GROUPS)
  targetMuscle?: TargetMuscleGroup;

  @IsOptional()
  @IsIn(TRAINING_LEVELS)
  trainingLevel?: TrainingLevel;

  @IsOptional()
  @IsIn(MOVEMENT_PATTERNS)
  movementPattern?: MovementPattern;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}
