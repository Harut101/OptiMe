import { Platform } from 'react-native';

import type { HealthPermissions, HealthProvider } from '@/types/api';

export function getPlatformHealthProvider(): HealthProvider | null {
  if (Platform.OS === 'ios') {
    return 'APPLE_HEALTH';
  }

  if (Platform.OS === 'android') {
    return 'HEALTH_CONNECT';
  }

  return null;
}

export function getPlatformHealthProviderLabel() {
  if (Platform.OS === 'ios') {
    return 'Apple Health';
  }

  if (Platform.OS === 'android') {
    return 'Health Connect';
  }

  return 'Health data';
}

export const FOUNDATION_HEALTH_PERMISSIONS: HealthPermissions = {
  steps: true,
  sleep: true,
  workouts: true,
  activeEnergy: true,
  weight: false,
  heartRate: false,
  restingHeartRate: false
};

