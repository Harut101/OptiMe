import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { PrismaClient, PreferredLocale } from '@prisma/client';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@optime/shared-types';

import { exerciseCatalog } from '../../prisma/seeds/exercises';
import { parseExerciseMediaFileName, readSourceFileNames, reconcileExerciseMedia } from './reconciliation';

export const MEDIA_VALIDATION_REASON_CODES = [
  'SOURCE_FILE_MISSING',
  'INVALID_FILENAME',
  'INVALID_WEBP_SIGNATURE',
  'UNSUPPORTED_WEBP_CHUNK',
  'INVALID_DIMENSIONS',
  'IMAGE_TOO_SMALL',
  'INVALID_ASPECT_RATIO',
  'FILE_TOO_LARGE',
  'EXERCISE_NOT_FOUND',
  'DUPLICATE_MEDIA_INDEX',
  'RENAME_TARGET_CONFLICT',
  'DESTINATION_CONTENT_CONFLICT',
  'PRIMARY_MEDIA_CONFLICT',
  'TRANSLATION_MISSING',
  'DATABASE_REGISTRATION_FAILED'
] as const;

export type MediaValidationReasonCode = (typeof MEDIA_VALIDATION_REASON_CODES)[number];

export interface MediaValidationFailure {
  filename: string;
  parsedSlug: string | null;
  reasonCode: MediaValidationReasonCode;
  explanation: string;
  blocksIngestion: true;
}

export interface ExerciseMediaManifestItem {
  seedKey: string;
  exerciseSlug: string;
  sourceFileName: string;
  destinationFileName: string;
  type: 'ANATOMY';
  width: number;
  height: number;
  sortOrder: number;
  isPrimary: boolean;
  isActive: true;
  relativeUrl: string;
  sha256: string;
}

export interface ExerciseMediaValidationReport {
  schemaVersion: 'exercise-media-validation.v1';
  summary: {
    sourceFiles: number;
    manifestItems: number;
    mediaCoveredExercises: number;
    fallbackOnlyExercises: number;
    validationFailures: number;
    copiedFiles?: number;
    exerciseMediaRows?: number;
    exerciseMediaTranslationRows?: number;
  };
  failures: MediaValidationFailure[];
  manifest: ExerciseMediaManifestItem[];
}

const workspaceRoot = resolve(__dirname, '../../../..');
const sourceDirectory = resolve(workspaceRoot, 'apps/mobile/assets/exercise-media/inbox');
const publicMediaRoot = resolve(workspaceRoot, 'apps/api/public/exercise-media');
const manifestPath = resolve(workspaceRoot, 'apps/mobile/assets/exercise-media/exercise-media-manifest.json');
const validationReportPath = resolve(workspaceRoot, 'apps/mobile/assets/exercise-media/exercise-media-validation.json');
const maxBytes = 15 * 1024 * 1024;
const expectedRatio = 4 / 5;
const aspectRatioTolerance = 0.03;
const localeMap: Record<SupportedLocale, PreferredLocale> = {
  'en-US': PreferredLocale.EN_US,
  'ru-RU': PreferredLocale.RU_RU,
  'fr-FR': PreferredLocale.FR_FR,
  'zh-CN': PreferredLocale.ZH_CN
};

export async function validateExerciseMediaAssets(): Promise<ExerciseMediaValidationReport> {
  const fileNames = await readSourceFileNames(sourceDirectory);
  const catalogBySlug = new Map(exerciseCatalog.map((exercise) => [exercise.slug, exercise] as const));
  const reconciliation = reconcileExerciseMedia({
    fileNames,
    sourceDirectory: 'apps/mobile/assets/exercise-media/inbox',
    catalog: exerciseCatalog.map((exercise) => ({
      slug: exercise.slug,
      name: exercise.translations.find((translation) => translation.locale === 'en-US')?.name ?? exercise.slug
    }))
  });
  const failures: MediaValidationFailure[] = [];
  const manifest: ExerciseMediaManifestItem[] = [];
  const mediaKeys = new Set<string>();
  const primaryBySlug = new Set<string>();

  for (const item of reconciliation.items) {
    const parsed = parseExerciseMediaFileName(item.sourceFileName);
    if (!parsed) {
      failures.push(failure(item.sourceFileName, null, 'INVALID_FILENAME', 'Filename does not match the strict anatomy WebP convention.'));
      continue;
    }
    if (item.status !== 'EXACT_MATCH' || !item.canonicalSlug || !item.canonicalFileName) {
      failures.push(failure(item.sourceFileName, parsed.parsedSlug, item.status === 'DUPLICATE_MEDIA_INDEX' ? 'DUPLICATE_MEDIA_INDEX' : item.status === 'RENAME_TARGET_CONFLICT' ? 'RENAME_TARGET_CONFLICT' : 'EXERCISE_NOT_FOUND', item.blockingReason ?? 'File does not resolve to an expanded catalog exercise.'));
      continue;
    }
    const exercise = catalogBySlug.get(item.canonicalSlug);
    if (!exercise) {
      failures.push(failure(item.sourceFileName, parsed.parsedSlug, 'EXERCISE_NOT_FOUND', 'Canonical exercise slug is absent from the expanded catalog.'));
      continue;
    }
    const sourcePath = resolve(sourceDirectory, item.sourceFileName);
    const sourceStat = await safeStat(sourcePath);
    if (!sourceStat) {
      failures.push(failure(item.sourceFileName, parsed.parsedSlug, 'SOURCE_FILE_MISSING', 'Source file is missing or not readable.'));
      continue;
    }
    if (!sourceStat.isFile()) {
      failures.push(failure(item.sourceFileName, parsed.parsedSlug, 'SOURCE_FILE_MISSING', 'Source path is not a regular file.'));
      continue;
    }
    if (sourceStat.size <= 0) failures.push(failure(item.sourceFileName, parsed.parsedSlug, 'INVALID_WEBP_SIGNATURE', 'Source file is empty.'));
    if (sourceStat.size > maxBytes) failures.push(failure(item.sourceFileName, parsed.parsedSlug, 'FILE_TOO_LARGE', 'Source file exceeds the 15 MB limit.'));
    const bytes = await readFile(sourcePath);
    const dimensions = readWebpDimensions(bytes);
    if (!dimensions.ok) {
      failures.push(failure(item.sourceFileName, parsed.parsedSlug, dimensions.reasonCode, dimensions.explanation));
      continue;
    }
    const { width, height } = dimensions;
    if (width <= 0 || height <= 0) failures.push(failure(item.sourceFileName, parsed.parsedSlug, 'INVALID_DIMENSIONS', 'Width and height must be positive.'));
    if (width < 800 || height < 1000) failures.push(failure(item.sourceFileName, parsed.parsedSlug, 'IMAGE_TOO_SMALL', 'Image must be at least 800x1000.'));
    if (Math.abs(width / height - expectedRatio) > aspectRatioTolerance) failures.push(failure(item.sourceFileName, parsed.parsedSlug, 'INVALID_ASPECT_RATIO', 'Image aspect ratio must be 4:5 within tolerance 0.03.'));
    const sortOrder = parsed.index - 1;
    const isPrimary = parsed.index === 1;
    const seedKey = `${item.canonicalSlug}-anatomy-${String(parsed.index).padStart(2, '0')}`;
    const mediaKey = `${item.canonicalSlug}:${parsed.index}`;
    if (mediaKeys.has(mediaKey)) failures.push(failure(item.sourceFileName, parsed.parsedSlug, 'DUPLICATE_MEDIA_INDEX', 'Duplicate exercise media index.'));
    mediaKeys.add(mediaKey);
    if (isPrimary) {
      if (primaryBySlug.has(item.canonicalSlug)) failures.push(failure(item.sourceFileName, parsed.parsedSlug, 'PRIMARY_MEDIA_CONFLICT', 'Only one active primary media item is allowed per exercise.'));
      primaryBySlug.add(item.canonicalSlug);
    }
    for (const locale of SUPPORTED_LOCALES) {
      if (!exercise.translations.find((translation) => translation.locale === locale)?.name.trim()) {
        failures.push(failure(item.sourceFileName, parsed.parsedSlug, 'TRANSLATION_MISSING', `Missing ${locale} exercise name for media alt text.`));
      }
    }
    manifest.push({
      seedKey,
      exerciseSlug: item.canonicalSlug,
      sourceFileName: item.sourceFileName,
      destinationFileName: item.canonicalFileName,
      type: 'ANATOMY',
      width,
      height,
      sortOrder,
      isPrimary,
      isActive: true,
      relativeUrl: `/exercise-media/${item.canonicalSlug}/${item.canonicalFileName}`,
      sha256: createHash('sha256').update(bytes).digest('hex')
    });
  }

  manifest.sort((a, b) => a.exerciseSlug.localeCompare(b.exerciseSlug) || a.sortOrder - b.sortOrder);
  const mediaCoveredExercises = new Set(manifest.map((item) => item.exerciseSlug)).size;
  const report: ExerciseMediaValidationReport = {
    schemaVersion: 'exercise-media-validation.v1',
    summary: {
      sourceFiles: fileNames.length,
      manifestItems: manifest.length,
      mediaCoveredExercises,
      fallbackOnlyExercises: exerciseCatalog.length - mediaCoveredExercises,
      validationFailures: failures.length
    },
    failures,
    manifest
  };
  await writeValidationReports(report);
  return report;
}

export async function ingestExerciseMediaAssets() {
  const report = await validateExerciseMediaAssets();
  if (report.failures.length) throw new Error(`ExerciseMedia ingestion blocked by ${report.failures.length} validation failure(s).`);
  let copiedFiles = 0;
  for (const item of report.manifest) {
    const sourcePath = resolve(sourceDirectory, item.sourceFileName);
    const destinationPath = resolve(publicMediaRoot, item.exerciseSlug, item.destinationFileName);
    await mkdir(dirname(destinationPath), { recursive: true });
    if (await fileExists(destinationPath)) {
      const existing = await readFile(destinationPath);
      const existingHash = createHash('sha256').update(existing).digest('hex');
      if (existingHash !== item.sha256) throw new Error(`DESTINATION_CONTENT_CONFLICT: ${item.destinationFileName}`);
    } else {
      await copyFile(sourcePath, destinationPath, constants.COPYFILE_EXCL);
      copiedFiles += 1;
    }
  }

  const prisma = new PrismaClient();
  try {
    for (const item of report.manifest) {
      const exercise = await prisma.exercise.findUniqueOrThrow({ where: { slug: item.exerciseSlug }, include: { translations: true } });
      const media = await prisma.exerciseMedia.upsert({
        where: { seedKey: item.seedKey },
        create: {
          seedKey: item.seedKey,
          exerciseId: exercise.id,
          type: item.type,
          url: item.relativeUrl,
          thumbnailUrl: item.relativeUrl,
          width: item.width,
          height: item.height,
          sortOrder: item.sortOrder,
          isPrimary: item.isPrimary,
          isActive: item.isActive,
          source: 'OptiMe approved exercise media',
          license: 'Owner-approved',
          attribution: null
        },
        update: {
          exerciseId: exercise.id,
          type: item.type,
          url: item.relativeUrl,
          thumbnailUrl: item.relativeUrl,
          width: item.width,
          height: item.height,
          sortOrder: item.sortOrder,
          isPrimary: item.isPrimary,
          isActive: item.isActive,
          source: 'OptiMe approved exercise media',
          license: 'Owner-approved',
          attribution: null
        }
      });
      for (const locale of SUPPORTED_LOCALES) {
        const name = exercise.translations.find((translation) => translation.locale === localeMap[locale])?.name
          ?? exercise.translations.find((translation) => translation.locale === PreferredLocale.EN_US)?.name
          ?? item.exerciseSlug;
        const data = { altText: altText(locale, name), caption: null as string | null };
        await prisma.exerciseMediaTranslation.upsert({
          where: { exerciseMediaId_locale: { exerciseMediaId: media.id, locale: localeMap[locale] } },
          create: { exerciseMediaId: media.id, locale: localeMap[locale], ...data },
          update: data
        });
      }
    }
    const [exerciseMediaRows, exerciseMediaTranslationRows] = await Promise.all([
      prisma.exerciseMedia.count({ where: { seedKey: { not: null } } }),
      prisma.exerciseMediaTranslation.count()
    ]);
    const ingestedReport = {
      ...report,
      summary: {
        ...report.summary,
        copiedFiles,
        exerciseMediaRows,
        exerciseMediaTranslationRows
      }
    };
    await writeValidationReports(ingestedReport);
    return ingestedReport;
  } finally {
    await prisma.$disconnect();
  }
}

function readWebpDimensions(bytes: Buffer):
  | { ok: true; width: number; height: number }
  | { ok: false; reasonCode: MediaValidationReasonCode; explanation: string } {
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    return { ok: false, reasonCode: 'INVALID_WEBP_SIGNATURE', explanation: 'Missing RIFF/WEBP signature.' };
  }
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunk = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + size > bytes.length) return { ok: false, reasonCode: 'INVALID_WEBP_SIGNATURE', explanation: 'WebP chunk extends beyond file size.' };
    if (chunk === 'VP8X') {
      if (size < 10) return { ok: false, reasonCode: 'INVALID_DIMENSIONS', explanation: 'VP8X chunk is too small.' };
      return { ok: true, width: 1 + readUInt24LE(bytes, data + 4), height: 1 + readUInt24LE(bytes, data + 7) };
    }
    if (chunk === 'VP8L') {
      if (size < 5 || bytes[data] !== 0x2f) return { ok: false, reasonCode: 'INVALID_DIMENSIONS', explanation: 'VP8L dimension header is invalid.' };
      const bits = bytes.readUInt32LE(data + 1);
      return { ok: true, width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
    }
    if (chunk === 'VP8 ') {
      if (size < 10 || bytes[data + 3] !== 0x9d || bytes[data + 4] !== 0x01 || bytes[data + 5] !== 0x2a) {
        return { ok: false, reasonCode: 'INVALID_DIMENSIONS', explanation: 'VP8 frame header is invalid.' };
      }
      return { ok: true, width: bytes.readUInt16LE(data + 6) & 0x3fff, height: bytes.readUInt16LE(data + 8) & 0x3fff };
    }
    offset = data + size + (size % 2);
  }
  return { ok: false, reasonCode: 'UNSUPPORTED_WEBP_CHUNK', explanation: 'No supported VP8/VP8L/VP8X chunk was found.' };
}

function readUInt24LE(bytes: Buffer, offset: number) {
  return bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16);
}

function failure(filename: string, parsedSlug: string | null, reasonCode: MediaValidationReasonCode, explanation: string): MediaValidationFailure {
  return { filename, parsedSlug, reasonCode, explanation, blocksIngestion: true };
}

async function safeStat(path: string) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

async function fileExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeValidationReports(report: ExerciseMediaValidationReport) {
  await writeFile(manifestPath, `${JSON.stringify(report.manifest, null, 2)}\n`, 'utf8');
  await writeFile(validationReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function altText(locale: SupportedLocale, name: string) {
  if (locale === 'ru-RU') return `Анатомическая иллюстрация упражнения «${name}»`;
  if (locale === 'fr-FR') return `Illustration anatomique de l’exercice « ${name} »`;
  if (locale === 'zh-CN') return `${name}的解剖示意图`;
  return `Anatomical illustration of ${name}`;
}
