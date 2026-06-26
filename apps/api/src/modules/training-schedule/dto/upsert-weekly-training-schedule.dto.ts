import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ExerciseEquipment,
  TargetMuscleGroup,
  TrainingEnvironment,
  TrainingScheduleDayOfWeek,
  TrainingScheduleOverrideMode
} from '@prisma/client';

export class WeeklyTrainingScheduleDayDto {
  @IsEnum(TrainingScheduleDayOfWeek)
  dayOfWeek!: TrainingScheduleDayOfWeek;

  @IsBoolean()
  isTrainingDay!: boolean;

  @IsEnum(TrainingScheduleOverrideMode)
  targetMusclesMode!: TrainingScheduleOverrideMode;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsEnum(TargetMuscleGroup, { each: true })
  targetMuscles?: TargetMuscleGroup[];

  @IsEnum(TrainingScheduleOverrideMode)
  environmentMode!: TrainingScheduleOverrideMode;

  @IsOptional()
  @IsEnum(TrainingEnvironment)
  environment?: TrainingEnvironment | null;

  @IsEnum(TrainingScheduleOverrideMode)
  equipmentMode!: TrainingScheduleOverrideMode;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsEnum(ExerciseEquipment, { each: true })
  availableEquipment?: ExerciseEquipment[];

  @IsEnum(TrainingScheduleOverrideMode)
  durationMode!: TrainingScheduleOverrideMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  durationMinutes?: number | null;

  @IsOptional()
  @IsEnum(TrainingScheduleOverrideMode)
  protocolMode?: TrainingScheduleOverrideMode;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  protocolPreference?: string | null;
}

export class UpsertWeeklyTrainingScheduleDto {
  @IsBoolean()
  isActive!: boolean;

  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => WeeklyTrainingScheduleDayDto)
  days!: WeeklyTrainingScheduleDayDto[];
}
