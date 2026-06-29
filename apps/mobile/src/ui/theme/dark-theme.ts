import { uiDarkColors } from './colors';
import { radius } from './radius';
import { shadows } from './shadows';
import { sizing } from './sizing';
import { spacing } from './spacing';
import { typography } from './typography';

export const darkTheme = {
  colors: uiDarkColors,
  spacing,
  typography,
  radius,
  shadows,
  sizing
} as const;
