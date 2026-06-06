import {
  TargetMuscleGroup,
  TrainingEquipment,
  TrainingLevel,
  TrainingOutcome
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

export class UpsertTrainingPreferenceDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsEnum(TargetMuscleGroup, { each: true })
  targetMuscleGroups?: TargetMuscleGroup[];

  @IsOptional()
  @IsEnum(TrainingOutcome)
  trainingOutcome?: TrainingOutcome | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsEnum(TrainingEquipment, { each: true })
  equipment?: TrainingEquipment[];

  @IsOptional()
  @IsEnum(TrainingLevel)
  trainingLevel?: TrainingLevel | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  limitationsOrPainAreas?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  preferredTrainingDays?: number[];
}
