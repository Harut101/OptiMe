import { HealthProvider } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class DisconnectHealthDto {
  @IsEnum(HealthProvider)
  provider!: HealthProvider;
}

