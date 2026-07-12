import { PreferredLocale } from '@prisma/client';
import type { SupportedLocale } from '@optime/shared-types';

export const FOOD_CATALOG_ENGLISH_LOCALE = PreferredLocale.EN_US;

export function toFoodCatalogLocale(locale: SupportedLocale) {
  const locales: Record<SupportedLocale, PreferredLocale> = {
    'en-US': PreferredLocale.EN_US,
    'ru-RU': PreferredLocale.RU_RU,
    'fr-FR': PreferredLocale.FR_FR,
    'zh-CN': PreferredLocale.ZH_CN
  };
  return locales[locale];
}
