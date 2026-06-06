import { IsBoolean } from 'class-validator';

export class UpdateTrainingIntentDto {
  @IsBoolean()
  noTrainingPlanned!: boolean;
}
