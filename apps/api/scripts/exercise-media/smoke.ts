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

if (!baseUrl) {
  console.error('Missing required --base-url=https://media.example');
  process.exitCode = 1;
} else {
  void main(baseUrl, timeoutMs).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

async function main(rawBaseUrl: string, timeout: number) {
  const base = normalizeBaseUrl(rawBaseUrl);
  const manifest = await readPackageManifest();
  const representative = selectRepresentativeItems(manifest.items);
  const results: SmokeResult[] = [];
  for (const item of representative) {
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
  const failures = results.filter((result) => result.status !== 200
    || !result.contentType?.includes('image/webp')
    || result.bytes <= 0
    || !result.cacheControl
    || !result.checksumMatches);
  if (missing.status !== 404) failures.push({
    path: 'exercise-media/__missing__/missing.webp',
    status: missing.status,
    contentType: missing.headers.get('content-type'),
    cacheControl: missing.headers.get('cache-control'),
    bytes: 0,
    checksumMatches: false
  });
  console.log(JSON.stringify({ baseUrl: base, checked: results.length, missingStatus: missing.status, failures, results }, null, 2));
  if (failures.length) process.exitCode = 1;
}

function selectRepresentativeItems(items: PackageManifestItem[]) {
  const firstFull = items.find((item) => item.role === 'full');
  const firstThumb = items.find((item) => item.role === 'thumbnail');
  const russianFull = items.find((item) => item.relativePath.includes('russian-twist_anatomy-02.webp') && item.role === 'full');
  const russianThumb = items.find((item) => item.relativePath.includes('russian-twist_anatomy-02_thumb.webp'));
  return [...new Set([firstFull, firstThumb, russianFull, russianThumb].filter((item): item is PackageManifestItem => Boolean(item)))];
}

function normalizeBaseUrl(value: string) {
  const url = new URL(value);
  return url.toString().replace(/\/+$/, '');
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
