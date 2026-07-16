import { Platform } from 'react-native';

const systemFontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'system-ui'
});

export const typography = {
  hero: {
    fontFamily: systemFontFamily,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '600',
    letterSpacing: -0.4
  },
  title: {
    fontFamily: systemFontFamily,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '600',
    letterSpacing: -0.35
  },
  heading: {
    fontFamily: systemFontFamily,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '600',
    letterSpacing: -0.25
  },
  bodyStrong: {
    fontFamily: systemFontFamily,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.25
  },
  body: {
    fontFamily: systemFontFamily,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '400',
    letterSpacing: -0.25
  },
  label: {
    fontFamily: systemFontFamily,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: -0.2
  },
  caption: {
    fontFamily: systemFontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: -0.2
  },
  button: {
    fontFamily: systemFontFamily,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.25
  },
  finePrint: {
    fontFamily: systemFontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: -0.1
  }
} as const;
