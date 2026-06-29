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
  background: '#F6F7F4',
  backgroundMuted: '#EDF2EE',
  surface: '#FBFCFA',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F0F4F1',
  card: '#FFFFFF',
  cardMuted: '#F5F8F6',
  cardPressed: '#ECF2EE',
  textPrimary: '#16231F',
  textSecondary: '#53645E',
  textMuted: '#7A8983',
  textInverse: '#FFFFFF',
  border: '#DDE7E1',
  divider: '#E8EFEA',
  accent: '#C9793F',
  accentMuted: '#FFF1E4',
  nutrition: '#16886F',
  nutritionMuted: '#E5F6EF',
  training: '#2D6CDF',
  trainingMuted: '#E8F0FF',
  recovery: '#7B61D1',
  recoveryMuted: '#F0EAFF',
  health: '#E84364',
  healthMuted: '#FFE9EE',
  success: '#2E8067',
  successMuted: '#E6F5EF',
  warning: '#B7791F',
  warningMuted: '#FFF4DA',
  danger: '#B84A4A',
  dangerMuted: '#FCEAEA',
  info: '#2563A9',
  infoMuted: '#E8F2FE'
} satisfies ThemeColors;

export const darkThemeColors = {
  background: '#111815',
  backgroundMuted: '#17211D',
  surface: '#18231F',
  surfaceElevated: '#202C27',
  surfaceMuted: '#25332D',
  card: '#202C27',
  cardMuted: '#26342F',
  cardPressed: '#2D3B35',
  textPrimary: '#F4F8F5',
  textSecondary: '#C4D0CA',
  textMuted: '#93A29B',
  textInverse: '#111815',
  border: '#314139',
  divider: '#27352F',
  accent: '#E1A15F',
  accentMuted: '#3A2C1E',
  nutrition: '#5ED0AF',
  nutritionMuted: '#173C34',
  training: '#7EA7F7',
  trainingMuted: '#1D2C4A',
  recovery: '#B2A0F2',
  recoveryMuted: '#30284A',
  health: '#FF7E95',
  healthMuted: '#46232B',
  success: '#7ED8B7',
  successMuted: '#193D35',
  warning: '#E8C06A',
  warningMuted: '#3E321A',
  danger: '#F09A9A',
  dangerMuted: '#462424',
  info: '#8AB9F5',
  infoMuted: '#1D324B'
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
  primary: lightThemeColors.nutrition,
  primaryDark: '#0F5F50'
} as const;
