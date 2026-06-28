import { HealthProvider } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class HealthSourceParamDto {
  @IsEnum(HealthProvider)
  source!: HealthProvider;
}
