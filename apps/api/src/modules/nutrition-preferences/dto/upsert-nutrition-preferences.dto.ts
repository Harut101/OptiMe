import { DietType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';

export class UpsertNutritionPreferencesDto {
  @IsOptional()
  @IsEnum(DietType)
  dietType?: DietType;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  mealsPerDay?: number;

  @IsOptional()
  @IsBoolean()
  noKnownAllergiesConfirmed?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  allergies?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  excludedFoods?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  dislikedFoods?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  preferredFoods?: string[];
}
