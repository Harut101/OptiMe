import { IsString } from 'class-validator';

export class StartWorkoutSessionDto {
  @IsString()
  dailyPlanId!: string;
}
