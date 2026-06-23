import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import sharp, { type OverlayOptions } from 'sharp';

import { validateExerciseMediaAssets } from './media-manifest';

const blockedFiles = [
  'barbell-hip-thrust_anatomy-01.webp',
  'bodyweight-squat_anatomy-01.webp',
  'cable-triceps-pushdown_anatomy-01.webp',
  'quadruped-leg-kickback_anatomy-01.webp',
  'standing-barbell-calf-raise_anatomy-01.webp'
] as const;

const workspaceRoot = resolve(__dirname, '../../../..');
const inboxDirectory = resolve(workspaceRoot, 'apps/mobile/assets/exercise-media/inbox');
const backupDirectory = resolve(workspaceRoot, 'apps/mobile/assets/exercise-media/source-originals/blocked-2x3');
const previewDirectory = resolve(workspaceRoot, 'apps/mobile/assets/exercise-media/previews/normalized-4x5');
const reportPath = resolve(workspaceRoot, 'apps/mobile/assets/exercise-media/exercise-media-normalization.json');
const contactSheetPath = resolve(previewDirectory, 'normalized-4x5-contact-sheet.webp');
const targetWidth = 1200;
const targetHeight = 1500;
const apply = process.argv.includes('--apply');

interface NormalizationItem {
  fileName: string;
  needsNormalization: boolean;
  currentDimensions: { width: number; height: number };
  currentAspectRatio: number;
  targetDimensions: { width: number; height: number };
  containedDimensions: { width: number; height: number };
  padding: { left: number; right: number; top: number; bottom: number };
  background: { r: number; g: number; b: number; alpha: number; strategy: string };
  originalSha256: string;
  finalSha256?: string;
  backupSha256?: string;
  outputPath: string;
}

async function main() {
  if (apply) await assertOnlyApprovedAspectRatioFailures();
  const items = [];
  for (const fileName of blockedFiles) items.push(await analyze(fileName));

  if (!apply) {
    printReport('Dry-run normalization', items);
    return;
  }

  await mkdir(backupDirectory, { recursive: true });
  await mkdir(previewDirectory, { recursive: true });
  const normalized: NormalizationItem[] = [];
  for (const item of items) normalized.push(await normalize(item));
  await writeFile(reportPath, `${JSON.stringify({ schemaVersion: 'exercise-media-normalization.v1', applied: true, items: normalized }, null, 2)}\n`, 'utf8');
  await writeContactSheet(normalized);
  printReport('Applied normalization', normalized);
  console.log(`Normalization report: apps/mobile/assets/exercise-media/exercise-media-normalization.json`);
  console.log(`Preview contact sheet: apps/mobile/assets/exercise-media/previews/normalized-4x5/normalized-4x5-contact-sheet.webp`);
}

async function assertOnlyApprovedAspectRatioFailures() {
  const report = await validateExerciseMediaAssets();
  const allowed = new Set<string>(blockedFiles);
  const unexpected = report.failures.filter((failure) => failure.reasonCode !== 'INVALID_ASPECT_RATIO' || !allowed.has(failure.filename as (typeof blockedFiles)[number]));
  if (unexpected.length) {
    throw new Error(`Normalization apply blocked by unexpected media validation failures: ${unexpected.map((failure) => `${failure.reasonCode}:${failure.filename}`).join(', ')}`);
  }
}

async function analyze(fileName: string): Promise<NormalizationItem> {
  const sourcePath = resolve(inboxDirectory, fileName);
  const backupPath = resolve(backupDirectory, fileName);
  const sourceBytes = await readFile(sourcePath);
  const sourceMetadata = await sharp(sourceBytes).metadata();
  if (!sourceMetadata.width || !sourceMetadata.height) throw new Error(`${fileName}: unable to read dimensions.`);
  const reportBytes = apply && await exists(backupPath) ? await readFile(backupPath) : sourceBytes;
  const reportMetadata = await sharp(reportBytes).metadata();
  if (!reportMetadata.width || !reportMetadata.height) throw new Error(`${fileName}: unable to read original dimensions.`);
  const scale = Math.min(targetWidth / reportMetadata.width, targetHeight / reportMetadata.height);
  const containedWidth = Math.round(reportMetadata.width * scale);
  const containedHeight = Math.round(reportMetadata.height * scale);
  const left = Math.floor((targetWidth - containedWidth) / 2);
  const top = Math.floor((targetHeight - containedHeight) / 2);
  const background = await detectBackground(reportBytes, reportMetadata.width, reportMetadata.height);
  return {
    fileName,
    needsNormalization: sourceMetadata.width !== targetWidth || sourceMetadata.height !== targetHeight,
    currentDimensions: { width: reportMetadata.width, height: reportMetadata.height },
    currentAspectRatio: Number((reportMetadata.width / reportMetadata.height).toFixed(6)),
    targetDimensions: { width: targetWidth, height: targetHeight },
    containedDimensions: { width: containedWidth, height: containedHeight },
    padding: {
      left,
      right: targetWidth - containedWidth - left,
      top,
      bottom: targetHeight - containedHeight - top
    },
    background,
    originalSha256: sha256(reportBytes),
    outputPath: `apps/mobile/assets/exercise-media/inbox/${fileName}`
  };
}

async function normalize(item: NormalizationItem): Promise<NormalizationItem> {
  const sourcePath = resolve(inboxDirectory, item.fileName);
  const backupPath = resolve(backupDirectory, item.fileName);
  const tempPath = `${sourcePath}.tmp-${process.pid}.webp`;
  const originalBytes = await readFile(sourcePath);
  await ensureBackup(sourcePath, backupPath, item.originalSha256);
  const backupSha256 = sha256(await readFile(backupPath));

  if (!item.needsNormalization) {
    return { ...item, backupSha256, finalSha256: sha256(originalBytes) };
  }

  await sharp(originalBytes)
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: 'contain',
      position: 'centre',
      background: { r: item.background.r, g: item.background.g, b: item.background.b, alpha: item.background.alpha }
    })
    .webp({ quality: 92 })
    .toFile(tempPath);

  const tempBytes = await readFile(tempPath);
  const tempMetadata = await sharp(tempBytes).metadata();
  if (tempMetadata.width !== targetWidth || tempMetadata.height !== targetHeight) {
    await rm(tempPath, { force: true });
    throw new Error(`${item.fileName}: temporary normalized output is not ${targetWidth}x${targetHeight}.`);
  }
  try {
    await rename(tempPath, sourcePath);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EBUSY') throw error;
    // Windows file watchers can briefly block atomic replacement. The temp file
    // is already validated, and the byte-identical original backup is in place.
    await writeFile(sourcePath, tempBytes);
    await removeTempWithRetry(tempPath);
  }
  const finalBytes = await readFile(sourcePath);
  return { ...item, backupSha256, finalSha256: sha256(finalBytes) };
}

async function ensureBackup(sourcePath: string, backupPath: string, expectedSha256: string) {
  if (await exists(backupPath)) {
    const existingSha256 = sha256(await readFile(backupPath));
    if (existingSha256 !== expectedSha256) {
      const sourceMetadata = await sharp(sourcePath).metadata();
      if (sourceMetadata.width === targetWidth && sourceMetadata.height === targetHeight) return;
      throw new Error(`Backup content conflict: ${backupPath}`);
    }
    return;
  }
  await copyFile(sourcePath, backupPath, constants.COPYFILE_EXCL);
  const backupSha256 = sha256(await readFile(backupPath));
  if (backupSha256 !== expectedSha256) throw new Error(`Backup checksum mismatch: ${backupPath}`);
}

async function detectBackground(bytes: Buffer, width: number, height: number) {
  const patchSize = Math.min(96, Math.floor(width / 8), Math.floor(height / 8));
  const patches = [
    { left: 0, top: 0 },
    { left: width - patchSize, top: 0 },
    { left: 0, top: height - patchSize },
    { left: width - patchSize, top: height - patchSize },
    { left: Math.floor((width - patchSize) / 2), top: 0 },
    { left: Math.floor((width - patchSize) / 2), top: height - patchSize }
  ];
  const samples: number[][] = [];
  for (const patch of patches) {
    const raw = await sharp(bytes).extract({ ...patch, width: patchSize, height: patchSize }).ensureAlpha().raw().toBuffer();
    for (let index = 0; index < raw.length; index += 4) {
      const r = raw[index];
      const g = raw[index + 1];
      const b = raw[index + 2];
      const a = raw[index + 3];
      const maxDelta = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
      if (a > 245 && maxDelta < 32 && r > 170 && g > 170 && b > 170) samples.push([r, g, b, a]);
    }
  }
  const fallback = [246, 246, 244, 255];
  const selected = samples.length > 50 ? [0, 1, 2, 3].map((channel) => median(samples.map((sample) => sample[channel]))) : fallback;
  return {
    r: selected[0],
    g: selected[1],
    b: selected[2],
    alpha: Number((selected[3] / 255).toFixed(4)),
    strategy: samples.length > 50 ? 'median of neutral high-alpha corner and outer-edge samples' : 'neutral fallback because safe background samples were insufficient'
  };
}

async function writeContactSheet(items: NormalizationItem[]) {
  const thumbs: OverlayOptions[] = [];
  const cellWidth = 240;
  const cellHeight = 300;
  for (let index = 0; index < items.length; index += 1) {
    const filePath = resolve(inboxDirectory, items[index].fileName);
    const input = await sharp(filePath).resize({ width: cellWidth, height: cellHeight, fit: 'contain', background: '#f6f6f4' }).webp({ quality: 85 }).toBuffer();
    thumbs.push({ input, left: index * cellWidth, top: 0 });
  }
  await sharp({
    create: {
      width: cellWidth * items.length,
      height: cellHeight,
      channels: 3,
      background: '#f6f6f4'
    }
  }).composite(thumbs).webp({ quality: 88 }).toFile(contactSheetPath);
}

async function removeTempWithRetry(path: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(path, { force: true });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 150 * (attempt + 1)));
    }
  }
  throw lastError;
}

function printReport(title: string, items: NormalizationItem[]) {
  console.log(title);
  for (const item of items) {
    console.log(`${item.fileName}: ${item.currentDimensions.width}x${item.currentDimensions.height} (${item.currentAspectRatio}) -> ${item.targetDimensions.width}x${item.targetDimensions.height}; contained ${item.containedDimensions.width}x${item.containedDimensions.height}; padding L${item.padding.left}/R${item.padding.right}/T${item.padding.top}/B${item.padding.bottom}; background rgba(${item.background.r},${item.background.g},${item.background.b},${item.background.alpha}); needed=${item.needsNormalization}; original=${item.originalSha256}${item.finalSha256 ? `; final=${item.finalSha256}` : ''}`);
  }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
