import { IsBoolean, IsOptional } from 'class-validator';

export class HealthPermissionsDto {
  @IsOptional()
  @IsBoolean()
  steps?: boolean;

  @IsOptional()
  @IsBoolean()
  sleep?: boolean;

  @IsOptional()
  @IsBoolean()
  workouts?: boolean;

  @IsOptional()
  @IsBoolean()
  activeEnergy?: boolean;

  @IsOptional()
  @IsBoolean()
  weight?: boolean;

  @IsOptional()
  @IsBoolean()
  heartRate?: boolean;

  @IsOptional()
  @IsBoolean()
  restingHeartRate?: boolean;
}

