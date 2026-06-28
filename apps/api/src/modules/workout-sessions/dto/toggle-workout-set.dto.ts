import { IsBoolean, IsInt, Min } from 'class-validator';

export class ToggleWorkoutSetDto {
  @IsInt()
  @Min(0)
  setIndex!: number;

  @IsBoolean()
  completed!: boolean;
}
