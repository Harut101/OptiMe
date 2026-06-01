import { IsBoolean, IsOptional } from 'class-validator';

export class GenerateDailyPlanDto {
  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;
}
