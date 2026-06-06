import { DailyCheckInType } from '@prisma/client';
import { IsEnum, IsObject } from 'class-validator';

export class CreateDailyPlanCheckInDto {
  @IsEnum(DailyCheckInType)
  type!: DailyCheckInType;

  @IsObject()
  payload!: Record<string, unknown>;
}
