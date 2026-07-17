import { HealthProvider } from '@prisma/client';

const SOURCE_PRIORITY: readonly HealthProvider[] = [
  HealthProvider.WHOOP,
  HealthProvider.GARMIN,
  HealthProvider.APPLE_HEALTH,
  HealthProvider.HEALTH_CONNECT,
  HealthProvider.MANUAL,
  HealthProvider.MOCK
];
const PROVIDER_FRESHNESS_WINDOW_MS = 6 * 60 * 60 * 1000;

type WearableSnapshotCandidate = {
  source: HealthProvider;
  capturedAt: Date;
  updatedAt: Date;
};

/**
 * Chooses one snapshot without mixing metrics between providers. A materially
 * newer source wins; otherwise, richer recovery-capable sources are preferred.
 */
export function selectPreferredWearableSnapshot<T extends WearableSnapshotCandidate>(
  snapshots: T[]
): T | null {
  if (snapshots.length === 0) return null;

  return [...snapshots].sort((left, right) => {
    const capturedAtDelta = right.capturedAt.getTime() - left.capturedAt.getTime();
    if (Math.abs(capturedAtDelta) > PROVIDER_FRESHNESS_WINDOW_MS) {
      return capturedAtDelta;
    }

    const priorityDelta = getSourcePriority(left.source) - getSourcePriority(right.source);
    if (priorityDelta !== 0) return priorityDelta;

    return right.updatedAt.getTime() - left.updatedAt.getTime();
  })[0];
}

function getSourcePriority(source: HealthProvider) {
  const index = SOURCE_PRIORITY.indexOf(source);
  return index === -1 ? SOURCE_PRIORITY.length : index;
}
