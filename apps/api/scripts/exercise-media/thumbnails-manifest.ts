import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';

import { validateExerciseMediaAssets, type ExerciseMediaManifestItem } from './media-manifest';

export const thumbnailSettings = {
  version: 1,
  format: 'webp',
  width: 480,
  height: 600,
  fit: 'contain',
  quality: 80
} as const;

export const workspaceRoot = resolve(__dirname, '../../../..');
export const publicMediaRoot = resolve(workspaceRoot, 'apps/api/public/exercise-media');
export const thumbnailReportPath = resolve(workspaceRoot, 'apps/mobile/assets/exercise-media/exercise-media-thumbnails.json');
export const packageRoot = resolve(workspaceRoot, 'apps/api/build/exercise-media-package');
export const packageMediaRoot = resolve(packageRoot, 'exercise-media');
export const packageManifestPath = resolve(packageRoot, 'exercise-media-package-manifest.json');

export interface ThumbnailManifestItem {
  seedKey: string;
  exerciseSlug: string;
  fullRelativeUrl: string;
  thumbnailRelativeUrl: string;
  fullPath: string;
  thumbnailPath: string;
  fullWidth: number;
  fullHeight: number;
  fullBytes: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  thumbnailBytes?: number;
  fullSha256: string;
  thumbnailSha256?: string;
  expectedThumbnailSha256: string;
  generationRequired: boolean;
  existingThumbnailStatus: 'missing' | 'identical' | 'owned-regeneratable' | 'conflict';
}

export interface ThumbnailReport {
  schemaVersion: 'exercise-media-thumbnails.v1';
  settings: typeof thumbnailSettings;
  summary: {
    fullMediaItems: number;
    thumbnails: number;
    generated?: number;
    skipped?: number;
    generationRequired?: number;
    validationFailures: number;
    minThumbnailBytes?: number;
    medianThumbnailBytes?: number;
    maxThumbnailBytes?: number;
    totalFullBytes: number;
    totalThumbnailBytes?: number;
    estimatedListViewTransferReductionPercent?: number;
    exerciseMediaRows?: number;
    exerciseMediaTranslationRows?: number;
  };
  failures: Array<{ seedKey: string; reasonCode: string; explanation: string }>;
  items: ThumbnailManifestItem[];
}

export interface PackageManifestItem {
  relativePath: string;
  bytes: number;
  sha256: string;
  contentType: 'image/webp';
  role: 'full' | 'thumbnail';
}

export interface PackageReport {
  schemaVersion: 'exercise-media-package.v1';
  summary: {
    fullMedia: number;
    thumbnails: number;
    totalFiles: number;
    totalBytes: number;
  };
  items: PackageManifestItem[];
}

export async function buildThumbnailReport(options: { apply: boolean }) {
  const mediaReport = await validateExerciseMediaAssets();
  if (mediaReport.failures.length) {
    throw new Error(`Thumbnail generation blocked by ${mediaReport.failures.length} full-media validation failure(s).`);
  }
  const previous = await readPreviousThumbnailReport();
  const previousByUrl = new Map(previous?.items.map((item) => [item.thumbnailRelativeUrl, item]));
  const items: ThumbnailManifestItem[] = [];
  const failures: ThumbnailReport['failures'] = [];
  let generated = 0;
  let skipped = 0;

  for (const mediaItem of mediaReport.manifest) {
    const item = await analyzeThumbnail(mediaItem, previousByUrl.get(thumbnailRelativeUrl(mediaItem)));
    items.push(item);
    if (item.existingThumbnailStatus === 'conflict') {
      failures.push({
        seedKey: item.seedKey,
        reasonCode: 'THUMBNAIL_CONTENT_CONFLICT',
        explanation: 'Existing thumbnail differs from deterministic output and is not recognized as a prior pipeline output.'
      });
      continue;
    }
    if (!options.apply) continue;
    if (!item.generationRequired) {
      skipped += 1;
      continue;
    }
    await writeThumbnail(item);
    const finalBytes = await readFile(item.thumbnailPath);
    item.thumbnailBytes = finalBytes.length;
    item.thumbnailSha256 = sha256(finalBytes);
    generated += 1;
  }

  if (options.apply && failures.length === 0) {
    await updateThumbnailUrls(items);
  }
  const appliedItems = options.apply ? await refreshExistingThumbnailStats(items) : items;
  const report = await toThumbnailReport(appliedItems, failures, { generated, skipped });
  if (options.apply) await writeThumbnailReport(report);
  return report;
}

export async function validateThumbnails() {
  const report = await buildThumbnailReport({ apply: false });
  const failures = [...report.failures];
  const prisma = new PrismaClient();
  try {
    for (const item of report.items) {
      if (item.existingThumbnailStatus === 'missing') {
        failures.push({ seedKey: item.seedKey, reasonCode: 'THUMBNAIL_MISSING', explanation: 'Expected thumbnail file is missing.' });
        continue;
      }
      if (item.thumbnailWidth !== thumbnailSettings.width || item.thumbnailHeight !== thumbnailSettings.height) {
        failures.push({ seedKey: item.seedKey, reasonCode: 'INVALID_THUMBNAIL_DIMENSIONS', explanation: 'Thumbnail must be exactly 480x600.' });
      }
      if ((item.thumbnailBytes ?? 0) <= 0) {
        failures.push({ seedKey: item.seedKey, reasonCode: 'EMPTY_THUMBNAIL', explanation: 'Thumbnail file is empty.' });
      }
      if ((item.thumbnailBytes ?? Number.POSITIVE_INFINITY) >= item.fullBytes) {
        failures.push({ seedKey: item.seedKey, reasonCode: 'THUMBNAIL_NOT_SMALLER', explanation: 'Thumbnail must be smaller than full-size source.' });
      }
      if (item.thumbnailSha256 !== item.expectedThumbnailSha256) {
        failures.push({ seedKey: item.seedKey, reasonCode: 'THUMBNAIL_CHECKSUM_MISMATCH', explanation: 'Thumbnail does not match deterministic generation settings.' });
      }
      if (!isCanonicalPublicPath(item.thumbnailPath)) {
        failures.push({ seedKey: item.seedKey, reasonCode: 'UNSAFE_THUMBNAIL_PATH', explanation: 'Thumbnail path escapes public media root.' });
      }
      const dbItem = await prisma.exerciseMedia.findUnique({ where: { seedKey: item.seedKey }, select: { thumbnailUrl: true, url: true } });
      if (!dbItem) {
        failures.push({ seedKey: item.seedKey, reasonCode: 'EXERCISE_MEDIA_MISSING', explanation: 'ExerciseMedia row is missing.' });
      } else {
        if (dbItem.url !== item.fullRelativeUrl) failures.push({ seedKey: item.seedKey, reasonCode: 'FULL_URL_CHANGED', explanation: 'ExerciseMedia full URL does not match manifest.' });
        if (dbItem.thumbnailUrl !== item.thumbnailRelativeUrl) failures.push({ seedKey: item.seedKey, reasonCode: 'THUMBNAIL_URL_MISMATCH', explanation: 'ExerciseMedia thumbnailUrl does not point to expected relative thumbnail path.' });
      }
    }
    const validated = await toThumbnailReport(report.items, failures, {});
    await writeThumbnailReport(validated);
    return validated;
  } finally {
    await prisma.$disconnect();
  }
}

export async function packageExerciseMedia() {
  const report = await validateThumbnails();
  if (report.failures.length) throw new Error(`Packaging blocked by ${report.failures.length} thumbnail validation failure(s).`);
  await rm(packageRoot, { recursive: true, force: true });
  await mkdir(packageMediaRoot, { recursive: true });
  const items: PackageManifestItem[] = [];
  for (const item of report.items) {
    for (const sourcePath of [item.fullPath, item.thumbnailPath]) {
      const role = sourcePath === item.fullPath ? 'full' as const : 'thumbnail' as const;
      const relativePath = toPublicRelativePath(sourcePath);
      const destinationPath = resolve(packageRoot, relativePath);
      await mkdir(dirname(destinationPath), { recursive: true });
      await copyFile(sourcePath, destinationPath, constants.COPYFILE_FICLONE_FORCE).catch(async () => copyFile(sourcePath, destinationPath));
      const bytes = await readFile(sourcePath);
      items.push({ relativePath: normalizeSlash(relativePath), bytes: bytes.length, sha256: sha256(bytes), contentType: 'image/webp', role });
    }
  }
  items.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const packageReport: PackageReport = {
    schemaVersion: 'exercise-media-package.v1',
    summary: {
      fullMedia: items.filter((item) => item.role === 'full').length,
      thumbnails: items.filter((item) => item.role === 'thumbnail').length,
      totalFiles: items.length,
      totalBytes: items.reduce((sum, item) => sum + item.bytes, 0)
    },
    items
  };
  await writeFile(packageManifestPath, `${JSON.stringify(packageReport, null, 2)}\n`, 'utf8');
  return packageReport;
}

export async function readPackageManifest() {
  return JSON.parse(await readFile(packageManifestPath, 'utf8')) as PackageReport;
}

async function analyzeThumbnail(mediaItem: ExerciseMediaManifestItem, previous?: ThumbnailManifestItem): Promise<ThumbnailManifestItem> {
  const fullPath = resolve(publicMediaRoot, mediaItem.exerciseSlug, mediaItem.destinationFileName);
  const fullBytes = await readFile(fullPath);
  const fullMetadata = await sharp(fullBytes).metadata();
  if (!fullMetadata.width || !fullMetadata.height) throw new Error(`${mediaItem.seedKey}: unable to read full media dimensions.`);
  const expectedBytes = await generateThumbnailBuffer(fullBytes);
  const thumbPath = resolve(publicMediaRoot, mediaItem.exerciseSlug, 'thumbnails', thumbnailFileName(mediaItem.destinationFileName));
  const existingBytes = await readOptional(thumbPath);
  const expectedHash = sha256(expectedBytes);
  let status: ThumbnailManifestItem['existingThumbnailStatus'] = 'missing';
  let thumbnailWidth: number = thumbnailSettings.width;
  let thumbnailHeight: number = thumbnailSettings.height;
  let thumbnailBytes: number | undefined;
  let thumbnailSha256: string | undefined;
  if (existingBytes) {
    thumbnailBytes = existingBytes.length;
    thumbnailSha256 = sha256(existingBytes);
    const metadata = await sharp(existingBytes).metadata();
    thumbnailWidth = metadata.width ?? 0;
    thumbnailHeight = metadata.height ?? 0;
    if (thumbnailSha256 === expectedHash) status = 'identical';
    else if (previous?.thumbnailSha256 === thumbnailSha256) status = 'owned-regeneratable';
    else status = 'conflict';
  }
  return {
    seedKey: mediaItem.seedKey,
    exerciseSlug: mediaItem.exerciseSlug,
    fullRelativeUrl: mediaItem.relativeUrl,
    thumbnailRelativeUrl: thumbnailRelativeUrl(mediaItem),
    fullPath,
    thumbnailPath: thumbPath,
    fullWidth: fullMetadata.width,
    fullHeight: fullMetadata.height,
    fullBytes: fullBytes.length,
    thumbnailWidth,
    thumbnailHeight,
    thumbnailBytes,
    fullSha256: sha256(fullBytes),
    thumbnailSha256,
    expectedThumbnailSha256: expectedHash,
    generationRequired: status === 'missing' || status === 'owned-regeneratable',
    existingThumbnailStatus: status
  };
}

async function writeThumbnail(item: ThumbnailManifestItem) {
  const sourceBytes = await readFile(item.fullPath);
  const outputBytes = await generateThumbnailBuffer(sourceBytes);
  const metadata = await sharp(outputBytes).metadata();
  if (metadata.width !== thumbnailSettings.width || metadata.height !== thumbnailSettings.height) {
    throw new Error(`${item.seedKey}: temporary thumbnail is not ${thumbnailSettings.width}x${thumbnailSettings.height}.`);
  }
  await mkdir(dirname(item.thumbnailPath), { recursive: true });
  const tempPath = `${item.thumbnailPath}.tmp-${process.pid}.webp`;
  await writeFile(tempPath, outputBytes);
  try {
    await copyFile(tempPath, item.thumbnailPath, constants.COPYFILE_EXCL);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
    await writeFile(item.thumbnailPath, outputBytes);
  } finally {
    await rm(tempPath, { force: true });
  }
}

async function generateThumbnailBuffer(sourceBytes: Buffer) {
  return sharp(sourceBytes)
    .resize({
      width: thumbnailSettings.width,
      height: thumbnailSettings.height,
      fit: 'contain',
      position: 'centre',
      background: { r: 246, g: 246, b: 244, alpha: 1 }
    })
    .webp({ quality: thumbnailSettings.quality })
    .toBuffer();
}

async function updateThumbnailUrls(items: ThumbnailManifestItem[]) {
  const prisma = new PrismaClient();
  try {
    for (const item of items) {
      await prisma.exerciseMedia.update({
        where: { seedKey: item.seedKey },
        data: { thumbnailUrl: item.thumbnailRelativeUrl }
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function refreshExistingThumbnailStats(items: ThumbnailManifestItem[]) {
  return Promise.all(items.map(async (item) => {
    const bytes = await readOptional(item.thumbnailPath);
    if (!bytes) return item;
    const metadata = await sharp(bytes).metadata();
    return {
      ...item,
      thumbnailBytes: bytes.length,
      thumbnailSha256: sha256(bytes),
      thumbnailWidth: metadata.width ?? item.thumbnailWidth,
      thumbnailHeight: metadata.height ?? item.thumbnailHeight,
      generationRequired: false,
      existingThumbnailStatus: sha256(bytes) === item.expectedThumbnailSha256 ? 'identical' as const : item.existingThumbnailStatus
    };
  }));
}

async function toThumbnailReport(items: ThumbnailManifestItem[], failures: ThumbnailReport['failures'], counts: { generated?: number; skipped?: number }): Promise<ThumbnailReport> {
  const thumbnailSizes = items.map((item) => item.thumbnailBytes).filter((value): value is number => typeof value === 'number').sort((a, b) => a - b);
  const totalFullBytes = items.reduce((sum, item) => sum + item.fullBytes, 0);
  const totalThumbnailBytes = thumbnailSizes.reduce((sum, bytes) => sum + bytes, 0);
  const [exerciseMediaRows, exerciseMediaTranslationRows] = await countMediaRows();
  return {
    schemaVersion: 'exercise-media-thumbnails.v1',
    settings: thumbnailSettings,
    summary: {
      fullMediaItems: items.length,
      thumbnails: thumbnailSizes.length,
      generated: counts.generated,
      skipped: counts.skipped,
      generationRequired: items.filter((item) => item.generationRequired).length,
      validationFailures: failures.length,
      minThumbnailBytes: thumbnailSizes[0],
      medianThumbnailBytes: thumbnailSizes.length ? thumbnailSizes[Math.floor(thumbnailSizes.length / 2)] : undefined,
      maxThumbnailBytes: thumbnailSizes.at(-1),
      totalFullBytes,
      totalThumbnailBytes: thumbnailSizes.length ? totalThumbnailBytes : undefined,
      estimatedListViewTransferReductionPercent: thumbnailSizes.length ? Number(((1 - totalThumbnailBytes / totalFullBytes) * 100).toFixed(1)) : undefined,
      exerciseMediaRows,
      exerciseMediaTranslationRows
    },
    failures,
    items
  };
}

async function countMediaRows() {
  if (!process.env.DATABASE_URL) return [undefined, undefined] as const;
  const prisma = new PrismaClient();
  try {
    return await Promise.all([
      prisma.exerciseMedia.count({ where: { seedKey: { not: null } } }),
      prisma.exerciseMediaTranslation.count()
    ]);
  } catch {
    return [undefined, undefined] as const;
  } finally {
    await prisma.$disconnect();
  }
}

function thumbnailFileName(destinationFileName: string) {
  return destinationFileName.replace(/\.webp$/i, '_thumb.webp');
}

function thumbnailRelativeUrl(item: ExerciseMediaManifestItem) {
  return `/exercise-media/${item.exerciseSlug}/thumbnails/${thumbnailFileName(item.destinationFileName)}`;
}

function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readOptional(path: string) {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

async function readPreviousThumbnailReport() {
  try {
    return JSON.parse(await readFile(thumbnailReportPath, 'utf8')) as ThumbnailReport;
  } catch {
    return null;
  }
}

async function writeThumbnailReport(report: ThumbnailReport) {
  await writeFile(thumbnailReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function isCanonicalPublicPath(path: string) {
  const relativePath = relative(publicMediaRoot, path);
  return Boolean(relativePath) && !relativePath.startsWith('..') && !relativePath.includes(`..${sep}`);
}

function toPublicRelativePath(path: string) {
  return join('exercise-media', relative(publicMediaRoot, path));
}

function normalizeSlash(value: string) {
  return value.replace(/\\/g, '/');
}

export async function listPublicMediaFiles(directory = publicMediaRoot): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listPublicMediaFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.webp')) files.push(path);
  }
  return files.sort();
}

export async function safeStat(path: string) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

export async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
