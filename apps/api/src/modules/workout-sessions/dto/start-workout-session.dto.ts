import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';
import { PreWorkoutReadinessStatus } from '@prisma/client';
import { WORKOUT_PAIN_AREAS } from '../workout-pain-mapping';

export class PreWorkoutCheckDto {
  @IsEnum(PreWorkoutReadinessStatus)
  readinessStatus!: PreWorkoutReadinessStatus;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsIn(WORKOUT_PAIN_AREAS, { each: true })
  painAreas?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @IsOptional()
  @IsBoolean()
  acknowledgedPainConflict?: boolean;
}

export class StartWorkoutSessionDto {
  @IsString()
  dailyPlanId!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PreWorkoutCheckDto)
  preWorkoutCheck?: PreWorkoutCheckDto;
}
