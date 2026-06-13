import { HealthProvider } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, ValidateNested } from 'class-validator';

import { HealthPermissionsDto } from './health-permissions.dto';

export class ConnectHealthDto {
  @IsEnum(HealthProvider)
  provider!: HealthProvider;

  @IsOptional()
  @ValidateNested()
  @Type(() => HealthPermissionsDto)
  permissionsGranted?: HealthPermissionsDto;
}

