import { uiColors } from './colors';
import { radius } from './radius';
import { shadows } from './shadows';
import { sizing } from './sizing';
import { spacing } from './spacing';
import { typography } from './typography';

export const lightTheme = {
  colors: uiColors,
  spacing,
  typography,
  radius,
  shadows,
  sizing
} as const;
