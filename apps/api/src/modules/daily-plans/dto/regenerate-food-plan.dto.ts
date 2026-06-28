import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RegenerateFoodPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
