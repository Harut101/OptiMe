import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MoveWorkoutDto {
  @IsString()
  @MaxLength(10)
  fromLocalDate!: string;

  @IsString()
  @MaxLength(10)
  toLocalDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;
}
