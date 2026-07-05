import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { PreWorkoutCheckDto } from '../../workout-sessions/dto/start-workout-session.dto';

export class AdjustTrainingForPreWorkoutDto {
  @ValidateNested()
  @Type(() => PreWorkoutCheckDto)
  preWorkoutCheck!: PreWorkoutCheckDto;
}
