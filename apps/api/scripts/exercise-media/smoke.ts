import { readPackageManifest, type PackageManifestItem } from './thumbnails-manifest';

interface SmokeResult {
  path: string;
  status: number;
  contentType: string | null;
  cacheControl: string | null;
  bytes: number;
  checksumMatches: boolean;
}

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=');
  return [key, rest.join('=') || 'true'];
}));
const baseUrl = args.get('--base-url');
const timeoutMs = Number(args.get('--timeout-ms') ?? 10000);
const checkAll = args.get('--all') === 'true';

if (!baseUrl) {
  console.error('Missing required --base-url=https://media.example');
  process.exitCode = 1;
} else {
  void main(baseUrl, timeoutMs, checkAll).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

async function main(rawBaseUrl: string, timeout: number, all: boolean) {
  const base = normalizeBaseUrl(rawBaseUrl);
  const manifest = await readPackageManifest();
  const selectedItems = all ? manifest.items : selectRepresentativeItems(manifest.items);
  const results: SmokeResult[] = [];
  for (const item of selectedItems) {
    const response = await fetchWithTimeout(`${base}/${item.relativePath}`, timeout);
    const bytes = Buffer.from(await response.arrayBuffer());
    const checksum = await sha256(bytes);
    results.push({
      path: item.relativePath,
      status: response.status,
      contentType: response.headers.get('content-type'),
      cacheControl: response.headers.get('cache-control'),
      bytes: bytes.length,
      checksumMatches: response.ok ? checksum === item.sha256 : false
    });
  }
  const missing = await fetchWithTimeout(`${base}/exercise-media/__missing__/missing.webp`, timeout);
  const failures = results.filter((result, index) => {
    const expected = selectedItems[index];
    return result.status !== 200
      || !result.contentType?.toLowerCase().includes(expected.contentType)
      || result.bytes <= 0
      || !hasBoundedPublicCache(result.cacheControl)
      || !result.checksumMatches;
  });
  if (missing.status !== 404) failures.push({
    path: 'exercise-media/__missing__/missing.webp',
    status: missing.status,
    contentType: missing.headers.get('content-type'),
    cacheControl: missing.headers.get('cache-control'),
    bytes: 0,
    checksumMatches: false
  });
  console.log(JSON.stringify({
    baseUrl: base,
    mode: all ? 'all' : 'representative',
    checked: results.length,
    passed: results.length - failures.length,
    missingStatus: missing.status,
    failures,
    ...(all ? {} : { results })
  }, null, 2));
  if (failures.length) process.exitCode = 1;
}

function selectRepresentativeItems(items: PackageManifestItem[]) {
  const firstFullWebp = items.find((item) => item.role === 'full' && item.format === 'webp');
  const firstFullJpeg = items.find((item) => item.role === 'full' && item.format === 'jpeg');
  const firstThumbWebp = items.find((item) => item.role === 'thumbnail' && item.format === 'webp');
  const firstThumbJpeg = items.find((item) => item.role === 'thumbnail' && item.format === 'jpeg');
  const alternateFull = items.find((item) => item.relativePath.includes('russian-twist_anatomy-02.webp') && item.role === 'full');
  return [...new Set([
    firstFullWebp,
    firstFullJpeg,
    firstThumbWebp,
    firstThumbJpeg,
    alternateFull
  ].filter((item): item is PackageManifestItem => Boolean(item)))];
}

function normalizeBaseUrl(value: string) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('Media base URL must use HTTPS except for localhost smoke tests.');
  }
  if (url.username || url.password) {
    throw new Error('Media base URL must not contain credentials.');
  }
  return url.toString().replace(/\/+$/, '');
}

function hasBoundedPublicCache(value: string | null) {
  if (!value) return false;
  const normalized = value.toLowerCase();
  const maxAge = normalized.match(/(?:^|,)\s*max-age=(\d+)/)?.[1];
  return normalized.includes('public') && Boolean(maxAge) && Number(maxAge) >= 86400;
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function sha256(bytes: Buffer) {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(bytes).digest('hex');
}
