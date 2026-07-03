type NativeHealthLogLevel = 'log' | 'warn' | 'error';

type NativeHealthLogMetadata = Record<string, string | number | boolean | null | undefined>;

export function logNativeHealthEvent(
  event: string,
  metadata: NativeHealthLogMetadata = {},
  level: NativeHealthLogLevel = 'log'
) {
  const safeMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  );
  const message = `[NativeHealth] ${event}`;

  if (__DEV__) {
    console[level](message, safeMetadata);
  }
}

