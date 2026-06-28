import { HealthProvider } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

import { IsValidTimezone } from './is-valid-timezone';

export class UpsertWearableSnapshotDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  localDate!: string;

  @IsString()
  @IsValidTimezone()
  timezone!: string;

  @IsEnum(HealthProvider)
  @IsIn([HealthProvider.APPLE_HEALTH])
  source!: typeof HealthProvider.APPLE_HEALTH;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  steps?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  activeCaloriesKcal?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  workoutMinutes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  sleepMinutes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  sleepQualityScore?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  recoveryScore?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(21)
  strainScore?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(220)
  restingHeartRateBpm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  hrvMs?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(5)
  @Max(40)
  respiratoryRate?: number | null;

  @IsOptional()
  @IsDateString()
  capturedAt?: string;
}
