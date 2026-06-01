import { GoalImpactMode, GoalType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, Max, Min, ValidateIf } from 'class-validator';

export class UpsertGoalDto {
  @IsEnum(GoalType)
  goalType!: GoalType;

  @ValidateIf((dto: UpsertGoalDto) => dto.goalType === GoalType.REDUCE_WEIGHT)
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(350)
  targetWeightKg?: number;

  @ValidateIf((dto: UpsertGoalDto) => dto.goalType === GoalType.REDUCE_WEIGHT)
  @Type(() => Number)
  @IsNumber()
  @Min(14)
  @Max(730)
  targetTimelineDays?: number;

  @IsOptional()
  @IsEnum(GoalImpactMode)
  impactMode?: GoalImpactMode;
}
