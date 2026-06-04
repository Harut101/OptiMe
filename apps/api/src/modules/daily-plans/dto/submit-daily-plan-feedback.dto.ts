import { PlanFeedbackRating, PlanFeedbackTag } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitDailyPlanFeedbackDto {
  @IsOptional()
  @IsEnum(PlanFeedbackRating)
  rating?: PlanFeedbackRating;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsEnum(PlanFeedbackTag, { each: true })
  tags?: PlanFeedbackTag[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
