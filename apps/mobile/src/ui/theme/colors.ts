import { darkThemeColors, lightThemeColors } from '@/theme/colors';

export const uiColors = {
  ...lightThemeColors,
  surfaceSecondary: lightThemeColors.surfaceMuted,
  textDisabled: lightThemeColors.textMuted,
  brand: lightThemeColors.health,
  primaryAction: lightThemeColors.health,
  primaryActionPressed: '#C92E50',
  brandSoft: lightThemeColors.healthMuted,
  successSoft: lightThemeColors.successMuted,
  infoSoft: lightThemeColors.infoMuted,
  warningSoft: lightThemeColors.warningMuted,
  error: lightThemeColors.danger,
  errorSoft: lightThemeColors.dangerMuted,
  macroProtein: lightThemeColors.recovery,
  macroCarbs: lightThemeColors.warning,
  macroFat: lightThemeColors.nutrition
} as const;

export const uiDarkColors = {
  ...darkThemeColors,
  surfaceSecondary: darkThemeColors.surfaceMuted,
  textDisabled: darkThemeColors.textMuted,
  brand: darkThemeColors.health,
  primaryAction: darkThemeColors.health,
  primaryActionPressed: '#F35C78',
  brandSoft: darkThemeColors.healthMuted,
  successSoft: darkThemeColors.successMuted,
  infoSoft: darkThemeColors.infoMuted,
  warningSoft: darkThemeColors.warningMuted,
  error: darkThemeColors.danger,
  errorSoft: darkThemeColors.dangerMuted,
  macroProtein: darkThemeColors.recovery,
  macroCarbs: darkThemeColors.warning,
  macroFat: darkThemeColors.nutrition
} as const;
