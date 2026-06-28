import { IsBoolean } from 'class-validator';

export class UpdateWorkoutExerciseProgressDto {
  @IsBoolean()
  isExerciseCompleted!: boolean;
}
