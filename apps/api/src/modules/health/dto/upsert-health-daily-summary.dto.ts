import { HealthProvider } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

import { IsValidTimezone } from './is-valid-timezone';

export class UpsertHealthDailySummaryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  localDate!: string;

  @IsString()
  @IsValidTimezone()
  timezone!: string;

  @IsEnum(HealthProvider)
  sourceProvider!: HealthProvider;

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
  @Max(1440)
  sleepMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  activeEnergyKcal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  workoutCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  workoutMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(220)
  averageHeartRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(220)
  restingHeartRate?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(20)
  @Max(400)
  weightKg?: number;
}
