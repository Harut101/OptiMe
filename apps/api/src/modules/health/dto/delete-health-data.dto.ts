import { HealthProvider } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class DeleteHealthDataDto {
  @IsOptional()
  @IsEnum(HealthProvider)
  provider?: HealthProvider;
}

