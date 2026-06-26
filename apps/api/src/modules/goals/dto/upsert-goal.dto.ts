import { GoalImpactMode, GoalType, PrimaryGoal } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, Max, Min, ValidateIf } from 'class-validator';

export class UpsertGoalDto {
  @IsOptional()
  @IsEnum(GoalType)
  goalType?: GoalType;

  @IsOptional()
  @IsEnum(PrimaryGoal)
  primaryGoal?: PrimaryGoal;

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

  @IsOptional()
  @IsEnum(GoalImpactMode)
  appMode?: GoalImpactMode;
}
