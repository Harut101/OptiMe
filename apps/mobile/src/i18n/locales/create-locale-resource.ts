import { enUS } from './en-US';

type LocaleShape<T> = {
  [K in keyof T]: T[K] extends string ? string : LocaleShape<T[K]>;
};
type LocaleOverrides<T> = {
  [K in keyof T]?: T[K] extends string ? string : LocaleOverrides<T[K]>;
};

export type LocaleResource = LocaleShape<typeof enUS>;

export function createLocaleResource(...overrides: Array<LocaleOverrides<typeof enUS>>): LocaleResource {
  let resource: unknown = enUS;
  for (const item of overrides) resource = merge(resource, item);
  return resource as LocaleResource;
}

function merge(base: unknown, overrides: unknown): unknown {
  if (!isRecord(base) || !isRecord(overrides)) return overrides ?? base;
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      key,
      key in overrides ? merge(value, overrides[key]) : value
    ])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
