import { IsIn, IsOptional } from 'class-validator';
import {
  MEASUREMENT_SYSTEMS,
  SUPPORTED_LOCALES,
  THEME_PREFERENCES,
  type MeasurementSystem,
  type SupportedLocale,
  type ThemePreference
} from '@optime/shared-types';

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  preferredLocale?: SupportedLocale;

  @IsOptional()
  @IsIn([...MEASUREMENT_SYSTEMS])
  measurementSystem?: MeasurementSystem;

  @IsOptional()
  @IsIn([...THEME_PREFERENCES])
  themePreference?: ThemePreference;
}
