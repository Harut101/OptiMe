import { HealthProvider } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

import { IsValidTimezone } from './is-valid-timezone';

export class CreateMockWearableSnapshotDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  localDate?: string;

  @IsOptional()
  @IsString()
  @IsValidTimezone()
  timezone?: string;

  @IsOptional()
  @IsEnum(HealthProvider)
  @IsIn([HealthProvider.MOCK, HealthProvider.MANUAL])
  source?: typeof HealthProvider.MOCK | typeof HealthProvider.MANUAL;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  steps?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  activeCaloriesKcal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  workoutMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  sleepMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  sleepQualityScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  recoveryScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(21)
  strainScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(220)
  restingHeartRateBpm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  hrvMs?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(5)
  @Max(40)
  respiratoryRate?: number;

  @IsOptional()
  @IsDateString()
  capturedAt?: string;
}
