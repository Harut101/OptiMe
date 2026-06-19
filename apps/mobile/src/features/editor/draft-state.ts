export function isDraftDirty<T>(value: T, persistedValue: T) {
  return JSON.stringify(value) !== JSON.stringify(persistedValue);
}
