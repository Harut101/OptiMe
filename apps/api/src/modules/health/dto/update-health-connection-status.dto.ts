import { HealthConnectionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateHealthConnectionStatusDto {
  @IsEnum(HealthConnectionStatus)
  status!: HealthConnectionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  errorCode?: string | null;
}
