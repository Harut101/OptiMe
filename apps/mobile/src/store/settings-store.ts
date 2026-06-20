import { create } from 'zustand';
import type { MeasurementSystem, SupportedLocale } from '@optime/shared-types';

import { i18n } from '@/i18n';
import { detectDeviceLocale } from '@/i18n/locale-detection';

interface SettingsState {
  preferredLocale: SupportedLocale;
  measurementSystem: MeasurementSystem;
  serverInitialized: boolean;
  applySettings: (
    preferredLocale: SupportedLocale,
    measurementSystem: MeasurementSystem,
    serverInitialized?: boolean
  ) => void;
  resetToDeviceDefaults: () => void;
}

const deviceLocale = detectDeviceLocale();

export const useSettingsStore = create<SettingsState>((set) => ({
  preferredLocale: deviceLocale,
  measurementSystem: 'METRIC',
  serverInitialized: false,
  applySettings: (preferredLocale, measurementSystem, serverInitialized = true) => {
    void i18n.changeLanguage(preferredLocale);
    set({ preferredLocale, measurementSystem, serverInitialized });
  },
  resetToDeviceDefaults: () => {
    const preferredLocale = detectDeviceLocale();
    void i18n.changeLanguage(preferredLocale);
    set({ preferredLocale, measurementSystem: 'METRIC', serverInitialized: false });
  }
}));
