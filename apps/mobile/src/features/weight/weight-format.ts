import type { MeasurementSystem } from '@optime/shared-types';

export function toDisplayWeight(weightKg: number, measurementSystem: MeasurementSystem) {
  return measurementSystem === 'IMPERIAL' ? weightKg * 2.2046226218 : weightKg;
}

export function getWeightUnit(measurementSystem: MeasurementSystem) {
  return measurementSystem === 'IMPERIAL' ? 'LB' : 'KG';
}

export function getWeightUnitLabel(measurementSystem: MeasurementSystem) {
  return measurementSystem === 'IMPERIAL' ? 'lb' : 'kg';
}
