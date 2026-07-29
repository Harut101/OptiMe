export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000/v1';

export const PRIVACY_POLICY_URL = normalizePublicUrl(
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL
);
export const TERMS_OF_SERVICE_URL = normalizePublicUrl(
  process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL
);
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || undefined;

function normalizePublicUrl(value?: string) {
  const normalized = value?.trim();

  if (!normalized) return undefined;

  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
