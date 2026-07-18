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
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#E5E5EA',
  card: '#FFFFFF',
  cardMuted: '#F2F2F7',
  cardPressed: '#E5E5EA',
  textPrimary: '#1C1C1E',
  textSecondary: '#6C6C70',
  textMuted: '#8E8E93',
  textInverse: '#FFFFFF',
  textOnAccent: '#FFFFFF',
  border: '#D1D1D6',
  divider: '#E5E5EA',
  accent: '#0088FF',
  accentMuted: '#E8F3FF',
  nutrition: '#34C759',
  nutritionMuted: '#E8FBE8',
  training: '#0088FF',
  trainingMuted: '#E8F3FF',
  recovery: '#CB30E0',
  recoveryMuted: '#F8E7FC',
  health: '#FF383C',
  healthMuted: '#FFE8E8',
  success: '#34C759',
  successMuted: '#E8FBE8',
  warning: '#FF8D28',
  warningMuted: '#FFF0E1',
  danger: '#FF383C',
  dangerMuted: '#FFE8E8',
  info: '#00C0E8',
  infoMuted: '#E4F8FF'
} satisfies ThemeColors;

export const darkThemeColors = {
  background: '#000000',
  backgroundMuted: '#0D0D0F',
  surface: '#0A0A0C',
  surfaceElevated: '#121214',
  surfaceMuted: '#1A1A1D',
  card: '#111113',
  cardMuted: '#151518',
  cardPressed: '#222226',
  textPrimary: '#FFFFFF',
  textSecondary: '#AEAEB2',
  textMuted: '#8E8E93',
  textInverse: '#111815',
  textOnAccent: '#FFFFFF',
  border: '#2B2B2F',
  divider: '#1B1B1E',
  accent: '#0091FF',
  accentMuted: '#102B4D',
  nutrition: '#30D158',
  nutritionMuted: '#173A1A',
  training: '#0091FF',
  trainingMuted: '#102B4D',
  recovery: '#DB34F2',
  recoveryMuted: '#3B143F',
  health: '#FF4245',
  healthMuted: '#451518',
  success: '#30D158',
  successMuted: '#173A1A',
  warning: '#FF9230',
  warningMuted: '#43240C',
  danger: '#FF4245',
  dangerMuted: '#451518',
  info: '#3CD3FE',
  infoMuted: '#12363F'
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
