import type {
  HealthConnectionFoundation,
  HealthDataSource,
  HealthProvider,
  WearableSnapshotResponse
} from '@/types/api';

export type HealthDataReadinessState =
  | 'FRESH'
  | 'STALE'
  | 'NOT_CONNECTED'
  | 'UNAVAILABLE'
  | 'DISMISSED_RECENTLY'
  | 'SYNCING'
  | 'ERROR';

export interface HealthDataReadiness {
  state: HealthDataReadinessState;
  source: HealthDataSource | null;
  isAvailableOnPlatform: boolean;
  lastSyncAt: string | null;
  snapshotLocalDate: string | null;
  snapshotIsStale: boolean;
  shouldPrompt: boolean;
  reasonCode:
    | 'FRESH_SAME_LOCAL_DATE'
    | 'CONNECTED_STALE_SNAPSHOT'
    | 'CONNECTED_MISSING_SNAPSHOT'
    | 'NO_CONNECTED_PROVIDER'
    | 'NO_ACTIVE_PROVIDER_ON_PLATFORM'
    | 'NO_PROVIDER_PROMPT_DISMISSED_RECENTLY';
}

interface ResolveHealthDataReadinessInput {
  connections?: HealthConnectionFoundation[];
  snapshot?: WearableSnapshotResponse;
  planLocalDate: string;
  platformProvider: HealthProvider | null;
  noProviderPromptDismissedRecently: boolean;
}

export function resolveHealthDataReadiness({
  connections = [],
  snapshot,
  planLocalDate,
  platformProvider,
  noProviderPromptDismissedRecently
}: ResolveHealthDataReadinessInput): HealthDataReadiness {
  const connectedSources = connections.filter((connection) => connection.status === 'CONNECTED');
  const preferredConnection = findPreferredConnection(connectedSources);
  const isAppleHealthAvailablePath = platformProvider === 'APPLE_HEALTH';
  const wearableSnapshot = snapshot?.snapshot ?? null;

  if (preferredConnection) {
    const snapshotMatchesConnection =
      Boolean(wearableSnapshot) && wearableSnapshot?.source === preferredConnection.source;
    const snapshotLocalDate = snapshotMatchesConnection ? wearableSnapshot?.localDate ?? null : null;
    const snapshotIsStale =
      !snapshotMatchesConnection ||
      Boolean(wearableSnapshot?.isStale) ||
      wearableSnapshot?.localDate !== planLocalDate ||
      snapshot?.hasRecentData === false;

    if (!snapshotIsStale && snapshotLocalDate === planLocalDate) {
      return {
        state: 'FRESH',
        source: preferredConnection.source,
        isAvailableOnPlatform: true,
        lastSyncAt: preferredConnection.lastSyncAt,
        snapshotLocalDate,
        snapshotIsStale: false,
        shouldPrompt: false,
        reasonCode: 'FRESH_SAME_LOCAL_DATE'
      };
    }

    return {
      state: 'STALE',
      source: preferredConnection.source,
      isAvailableOnPlatform: true,
      lastSyncAt: preferredConnection.lastSyncAt,
      snapshotLocalDate,
      snapshotIsStale: true,
      shouldPrompt: preferredConnection.source === 'APPLE_HEALTH',
      reasonCode: snapshotMatchesConnection ? 'CONNECTED_STALE_SNAPSHOT' : 'CONNECTED_MISSING_SNAPSHOT'
    };
  }

  if (!isAppleHealthAvailablePath) {
    return {
      state: 'UNAVAILABLE',
      source: null,
      isAvailableOnPlatform: false,
      lastSyncAt: null,
      snapshotLocalDate: wearableSnapshot?.localDate ?? null,
      snapshotIsStale: true,
      shouldPrompt: false,
      reasonCode: 'NO_ACTIVE_PROVIDER_ON_PLATFORM'
    };
  }

  if (noProviderPromptDismissedRecently) {
    return {
      state: 'DISMISSED_RECENTLY',
      source: null,
      isAvailableOnPlatform: true,
      lastSyncAt: null,
      snapshotLocalDate: wearableSnapshot?.localDate ?? null,
      snapshotIsStale: true,
      shouldPrompt: false,
      reasonCode: 'NO_PROVIDER_PROMPT_DISMISSED_RECENTLY'
    };
  }

  return {
    state: 'NOT_CONNECTED',
    source: null,
    isAvailableOnPlatform: true,
    lastSyncAt: null,
    snapshotLocalDate: wearableSnapshot?.localDate ?? null,
    snapshotIsStale: true,
    shouldPrompt: true,
    reasonCode: 'NO_CONNECTED_PROVIDER'
  };
}

function findPreferredConnection(connections: HealthConnectionFoundation[]) {
  return (
    connections.find((connection) => connection.source === 'APPLE_HEALTH') ??
    connections.find((connection) => connection.source === 'MOCK') ??
    connections.find((connection) => connection.source === 'MANUAL') ??
    connections[0] ??
    null
  );
}
