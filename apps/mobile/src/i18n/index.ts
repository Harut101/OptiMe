import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE } from '@optime/shared-types';

import { detectDeviceLocale } from './locale-detection';
import { enUS } from './locales/en-US';
import { frFR } from './locales/fr-FR';
import { ruRU } from './locales/ru-RU';
import { zhCN } from './locales/zh-CN';

export const translationResources = {
  'en-US': { translation: enUS },
  'ru-RU': { translation: ruRU },
  'fr-FR': { translation: frFR },
  'zh-CN': { translation: zhCN }
} as const;

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: translationResources,
    lng: detectDeviceLocale(),
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: Object.keys(translationResources),
    nonExplicitSupportedLngs: false,
    interpolation: { escapeValue: false },
    returnNull: false,
    saveMissing: __DEV__,
    missingKeyHandler: (_languages: readonly string[], namespace: string, key: string) => {
      if (__DEV__) console.warn(`[i18n] Missing translation: ${namespace}:${key}`);
    }
  });
}

export { i18n };
