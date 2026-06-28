import { IsBoolean, IsOptional } from 'class-validator';

export class CompleteWorkoutSessionDto {
  @IsOptional()
  @IsBoolean()
  confirmPartialCompletion?: boolean;
}
