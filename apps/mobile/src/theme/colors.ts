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
  background: '#F5F7F2',
  backgroundMuted: '#EAF1EC',
  surface: '#FCFDFB',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#EAF1EC',
  card: '#FFFFFF',
  cardMuted: '#F1F7F3',
  cardPressed: '#E5EFE9',
  textPrimary: '#16231F',
  textSecondary: '#4C5F58',
  textMuted: '#6E817A',
  textInverse: '#FFFFFF',
  border: '#D3E1DA',
  divider: '#E3ECE7',
  accent: '#D06A2A',
  accentMuted: '#FFE8D5',
  nutrition: '#00A77B',
  nutritionMuted: '#D8F5EA',
  training: '#2563EB',
  trainingMuted: '#DDEBFF',
  recovery: '#8B5CF6',
  recoveryMuted: '#EDE5FF',
  health: '#FF2D55',
  healthMuted: '#FFE1E8',
  success: '#18875D',
  successMuted: '#DDF4E8',
  warning: '#C47A00',
  warningMuted: '#FFECC1',
  danger: '#C94343',
  dangerMuted: '#FADADA',
  info: '#1673D1',
  infoMuted: '#DDEEFF'
} satisfies ThemeColors;

export const darkThemeColors = {
  background: '#101713',
  backgroundMuted: '#17221D',
  surface: '#18241F',
  surfaceElevated: '#22302A',
  surfaceMuted: '#283932',
  card: '#22302A',
  cardMuted: '#2A3B34',
  cardPressed: '#33463E',
  textPrimary: '#F4F8F5',
  textSecondary: '#C4D0CA',
  textMuted: '#93A29B',
  textInverse: '#111815',
  border: '#3A4A42',
  divider: '#2E3E37',
  accent: '#F0A35A',
  accentMuted: '#46301D',
  nutrition: '#45D6AA',
  nutritionMuted: '#17483D',
  training: '#82AFFF',
  trainingMuted: '#20365C',
  recovery: '#BEA7FF',
  recoveryMuted: '#392B60',
  health: '#FF6F8A',
  healthMuted: '#542833',
  success: '#72D8AE',
  successMuted: '#1B473B',
  warning: '#F0C05C',
  warningMuted: '#4B3718',
  danger: '#F48E8E',
  dangerMuted: '#532828',
  info: '#88C2FF',
  infoMuted: '#203A58'
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
  primaryDark: '#08745C'
} as const;
