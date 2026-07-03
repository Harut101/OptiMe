import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';
import { PreWorkoutReadinessStatus } from '@prisma/client';

export class PreWorkoutCheckDto {
  @IsEnum(PreWorkoutReadinessStatus)
  readinessStatus!: PreWorkoutReadinessStatus;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  painAreas?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class StartWorkoutSessionDto {
  @IsString()
  dailyPlanId!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PreWorkoutCheckDto)
  preWorkoutCheck?: PreWorkoutCheckDto;
}
