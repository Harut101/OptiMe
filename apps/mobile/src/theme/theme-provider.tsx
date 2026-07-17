import type { ThemePreference } from '@optime/shared-types';
import { PropsWithChildren, createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/store/settings-store';

import { darkThemeColors, lightThemeColors, type ThemeColors, type ThemeMode } from './colors';

interface ThemeContextValue {
  colors: ThemeColors;
  mode: ThemeMode;
  preference: ThemePreference;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightThemeColors,
  mode: 'light',
  preference: 'SYSTEM'
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const preference = useSettingsStore((state) => state.themePreference);
  const systemColorScheme = useColorScheme();
  const mode: ThemeMode =
    preference === 'SYSTEM'
      ? systemColorScheme === 'dark'
        ? 'dark'
        : 'light'
      : preference === 'DARK'
        ? 'dark'
        : 'light';
  const value = useMemo(
    () => ({
      colors: mode === 'dark' ? darkThemeColors : lightThemeColors,
      mode,
      preference
    }),
    [mode, preference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
