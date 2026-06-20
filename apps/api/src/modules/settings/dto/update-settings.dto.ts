import { IsIn, IsOptional } from 'class-validator';
import {
  MEASUREMENT_SYSTEMS,
  SUPPORTED_LOCALES,
  type MeasurementSystem,
  type SupportedLocale
} from '@optime/shared-types';

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  preferredLocale?: SupportedLocale;

  @IsOptional()
  @IsIn([...MEASUREMENT_SYSTEMS])
  measurementSystem?: MeasurementSystem;
}
