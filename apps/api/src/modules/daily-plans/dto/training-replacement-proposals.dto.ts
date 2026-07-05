import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { WORKOUT_PAIN_AREAS } from '../../workout-sessions/workout-pain-mapping';

class ReplacementPreWorkoutCheckDto {
  @IsIn(['PAIN_OR_LIMITATION'])
  readinessStatus!: string;

  @IsArray()
  @IsIn(WORKOUT_PAIN_AREAS, { each: true })
  painAreas!: string[];

  @IsOptional()
  @IsString()
  note?: string | null;
}

export class TrainingReplacementProposalsDto {
  @ValidateNested()
  @Type(() => ReplacementPreWorkoutCheckDto)
  preWorkoutCheck!: ReplacementPreWorkoutCheckDto;

  @IsArray()
  @IsString({ each: true })
  conflictingExerciseKeys!: string[];
}

export class ApplyTrainingReplacementsDto extends TrainingReplacementProposalsDto {
  @IsArray()
  @IsString({ each: true })
  acceptedOriginalPlanExerciseKeys!: string[];
}
