import { ActivityLevel, PregnancyStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';

export class UpsertProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsEnum(PregnancyStatus)
  pregnancyStatus?: PregnancyStatus;

  @Type(() => Date)
  @IsDate()
  dateOfBirth!: Date;

  @Type(() => Number)
  @IsNumber()
  @Min(80)
  @Max(260)
  heightCm!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(350)
  weightKg!: number;

  @IsEnum(ActivityLevel)
  activityLevel!: ActivityLevel;

  @IsOptional()
  @IsBoolean()
  privacyConsentAccepted?: boolean;
}
