import { PreferredLocale } from '@prisma/client';
import { DEFAULT_LOCALE, resolveSupportedLocale, type SupportedLocale } from '@optime/shared-types';

const TO_PRISMA: Record<SupportedLocale, PreferredLocale> = {
  'en-US': PreferredLocale.EN_US,
  'ru-RU': PreferredLocale.RU_RU,
  'fr-FR': PreferredLocale.FR_FR,
  'zh-CN': PreferredLocale.ZH_CN
};

export function resolveExerciseLocale(acceptLanguage?: string): SupportedLocale {
  const requested = acceptLanguage?.split(',')[0]?.split(';')[0]?.trim();
  return resolveSupportedLocale(requested);
}

export function toPrismaLocale(locale: SupportedLocale) {
  return TO_PRISMA[locale];
}

export const ENGLISH_PRISMA_LOCALE = TO_PRISMA[DEFAULT_LOCALE];
