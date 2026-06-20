import {
  DEFAULT_LOCALE,
  resolveSupportedLocale,
  type MeasurementSystem,
  type SupportedLocale
} from '@optime/shared-types';

function safeLocale(locale?: string): SupportedLocale {
  return resolveSupportedLocale(locale ?? DEFAULT_LOCALE);
}

export function formatDate(value: Date | string, locale?: string) {
  return new Intl.DateTimeFormat(safeLocale(locale), { dateStyle: 'medium' }).format(toDate(value));
}

export function formatTime(value: Date | string, locale?: string) {
  return new Intl.DateTimeFormat(safeLocale(locale), { timeStyle: 'short' }).format(new Date(value));
}

function toDate(value: Date | string) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

export function formatNumber(value: number, locale?: string, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(safeLocale(locale), options).format(value);
}

export function formatPercentage(value: number, locale?: string) {
  return formatNumber(value, locale, { style: 'percent', maximumFractionDigits: 0 });
}

export function formatWeight(
  weightKg: number,
  locale: string,
  measurementSystem: MeasurementSystem
) {
  if (measurementSystem === 'IMPERIAL') {
    return formatUnit(weightKg * 2.2046226218, locale, 'pound', 1);
  }
  return formatUnit(weightKg, locale, 'kilogram', 1);
}

export function formatHeight(
  heightCm: number,
  locale: string,
  measurementSystem: MeasurementSystem
) {
  if (measurementSystem === 'IMPERIAL') {
    const totalInches = Math.round(heightCm / 2.54);
    return `${formatUnit(Math.floor(totalInches / 12), locale, 'foot', 0)} ${formatUnit(totalInches % 12, locale, 'inch', 0)}`;
  }
  return formatUnit(heightCm, locale, 'centimeter', 0);
}

function formatUnit(
  value: number,
  locale: string,
  unit: Intl.NumberFormatOptions['unit'],
  maximumFractionDigits: number
) {
  return formatNumber(value, locale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits
  });
}
