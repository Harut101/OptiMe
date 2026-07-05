import { Type } from 'class-transformer';
import { IsString, ValidateNested } from 'class-validator';

import { PreWorkoutCheckDto } from './start-workout-session.dto';

export class PreWorkoutPreflightDto {
  @IsString()
  dailyPlanId!: string;

  @ValidateNested()
  @Type(() => PreWorkoutCheckDto)
  preWorkoutCheck!: PreWorkoutCheckDto;
}
