import { IntensityLevel, SportType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreateTrainingScheduleItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  localTime!: string;

  @IsEnum(SportType)
  sportType!: SportType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  durationMinutes!: number;

  @IsEnum(IntensityLevel)
  intensity!: IntensityLevel;

  @IsOptional()
  @IsString()
  description?: string;
}
