import { getLocales } from 'expo-localization';
import { resolveSupportedLocale, type SupportedLocale } from '@optime/shared-types';

export function detectDeviceLocale(): SupportedLocale {
  const primaryLocale = getLocales()[0];
  return resolveSupportedLocale(primaryLocale?.languageTag);
}
