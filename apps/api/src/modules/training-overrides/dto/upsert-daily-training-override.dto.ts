import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DailyTrainingOverrideSource,
  DailyTrainingOverrideType,
  ExerciseEquipment,
  TargetMuscleGroup,
  TrainingEnvironment
} from '@prisma/client';

export class UpsertDailyTrainingOverrideDto {
  @IsEnum(DailyTrainingOverrideType)
  overrideType!: DailyTrainingOverrideType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsEnum(TargetMuscleGroup, { each: true })
  targetMuscles?: TargetMuscleGroup[];

  @IsOptional()
  @IsEnum(TrainingEnvironment)
  environment?: TrainingEnvironment | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsEnum(ExerciseEquipment, { each: true })
  availableEquipment?: ExerciseEquipment[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  durationMinutes?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  protocolPreference?: string | null;

  @IsOptional()
  @IsEnum(DailyTrainingOverrideSource)
  source?: DailyTrainingOverrideSource;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  movedFromLocalDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  movedToLocalDate?: string | null;
}
