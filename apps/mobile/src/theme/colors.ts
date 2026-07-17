export type ThemeColors = {
  background: string;
  backgroundMuted: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  card: string;
  cardMuted: string;
  cardPressed: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  textOnAccent: string;
  border: string;
  divider: string;
  accent: string;
  accentMuted: string;
  nutrition: string;
  nutritionMuted: string;
  training: string;
  trainingMuted: string;
  recovery: string;
  recoveryMuted: string;
  health: string;
  healthMuted: string;
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  danger: string;
  dangerMuted: string;
  info: string;
  infoMuted: string;
};

export const lightThemeColors = {
  background: '#F2F2F7',
  backgroundMuted: '#E5E5EA',
  surface: '#FCFDFB',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#E5E5EA',
  card: '#FFFFFF',
  cardMuted: '#F7F7FA',
  cardPressed: '#E5E5EA',
  textPrimary: '#1C1C1E',
  textSecondary: '#636366',
  textMuted: '#848484',
  textInverse: '#FFFFFF',
  textOnAccent: '#FFFFFF',
  border: '#D1D1D6',
  divider: '#E5E5EA',
  accent: '#EC6330',
  accentMuted: '#FFF0E8',
  nutrition: '#67CE67',
  nutritionMuted: '#E8FBE8',
  training: '#3A82F7',
  trainingMuted: '#EAF2FF',
  recovery: '#B25FEA',
  recoveryMuted: '#F5E9FF',
  health: '#EB4B62',
  healthMuted: '#FFE9EE',
  success: '#34C759',
  successMuted: '#E8FBE8',
  warning: '#F1A33B',
  warningMuted: '#FFF3DE',
  danger: '#EB4B62',
  dangerMuted: '#FFE9EE',
  info: '#81CFFA',
  infoMuted: '#E9F8FF'
} satisfies ThemeColors;

export const darkThemeColors = {
  background: '#000000',
  backgroundMuted: '#1C1C1E',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  surfaceMuted: '#3A3A3C',
  card: '#1C1C1E',
  cardMuted: '#2C2C2E',
  cardPressed: '#3A3A3C',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D1D6',
  textMuted: '#8E8E93',
  textInverse: '#111815',
  textOnAccent: '#FFFFFF',
  border: '#3A3A3C',
  divider: '#2C2C2E',
  accent: '#FF8A4F',
  accentMuted: '#3B2118',
  nutrition: '#67CE67',
  nutritionMuted: '#173A1A',
  training: '#6EA4FF',
  trainingMuted: '#172D52',
  recovery: '#C77DFF',
  recoveryMuted: '#341B4F',
  health: '#FF5C73',
  healthMuted: '#441923',
  success: '#67CE67',
  successMuted: '#173A1A',
  warning: '#F1A33B',
  warningMuted: '#3E2A10',
  danger: '#FF5C73',
  dangerMuted: '#441923',
  info: '#87E3E1',
  infoMuted: '#123839'
} satisfies ThemeColors;

export type ThemeMode = 'light' | 'dark';

export const themeColorsByMode = {
  light: lightThemeColors,
  dark: darkThemeColors
} as const;

// Backward-compatible production aliases. New code should prefer semantic names.
export const colors = {
  ...lightThemeColors,
  ink: lightThemeColors.textPrimary,
  muted: lightThemeColors.textSecondary,
  line: lightThemeColors.border,
  primary: lightThemeColors.health,
  primaryDark: lightThemeColors.danger
} as const;
