import { basename, resolve, sep } from 'node:path';
import { readdir, rename, writeFile } from 'node:fs/promises';

export const EXERCISE_MEDIA_FILE_PATTERN = /^(?<slug>[a-z0-9]+(?:-[a-z0-9]+)*)_anatomy-(?<index>\d{2})\.webp$/;

export const EXERCISE_MEDIA_SLUG_ALIASES: Readonly<Record<string, string>> = {
  'cable-crossover-fly': 'cable-chest-fly',
  'dumbbell-bicep-curl': 'dumbbell-biceps-curl',
  'dumbbell-lateral-raise': 'lateral-raise',
  'machine-hip-abductor': 'hip-abduction-machine',
  'machine-hip-adductor': 'hip-adduction-machine',
  'cable-row': 'seated-cable-row',
  'calf-raise': 'standing-calf-raise'
};

export const EXERCISE_MEDIA_ALIAS_REASONS: Readonly<Record<string, string>> = {
  'cable-crossover-fly': 'Reviewed naming synonym for the seeded Cable Chest Fly exercise.',
  'dumbbell-bicep-curl': 'Reviewed singular/plural naming difference for Dumbbell Biceps Curl.',
  'dumbbell-lateral-raise': 'The seeded Lateral Raise explicitly uses dumbbells.',
  'machine-hip-abductor': 'Reviewed word-order difference for Hip Abduction Machine.',
  'machine-hip-adductor': 'Reviewed word-order difference for Hip Adduction Machine.',
  'cable-row': 'Approved catalog-alignment alias for the seeded Seated Cable Row exercise.',
  'calf-raise': 'Approved catalog-alignment alias for the seeded Standing Calf Raise exercise.'
};

export type ReconciliationStatus =
  | 'EXACT_MATCH'
  | 'ALIAS_MATCH'
  | 'CATALOG_EXERCISE_MISSING'
  | 'AMBIGUOUS_ALIAS'
  | 'INVALID_FILENAME'
  | 'DUPLICATE_FILE_NAME'
  | 'DUPLICATE_MEDIA_INDEX'
  | 'RENAME_TARGET_CONFLICT';

export interface CatalogExerciseIdentity {
  slug: string;
  name: string;
}

export interface ParsedExerciseMediaFile {
  fileName: string;
  parsedSlug: string;
  mediaType: 'ANATOMY';
  index: number;
}

export interface ExerciseMediaReconciliationItem {
  sourceFileName: string;
  parsedSlug: string | null;
  mediaIndex: number | null;
  canonicalExerciseName: string | null;
  canonicalSlug: string | null;
  canonicalFileName: string | null;
  status: ReconciliationStatus;
  aliasReason?: string;
  blockingReason?: string;
}

export interface ExerciseMediaReconciliationReport {
  schemaVersion: 'exercise-media-reconciliation.v1';
  sourceDirectory: string;
  summary: {
    catalogExercises: number;
    sourceFiles: number;
    uniqueParsedImageSlugs: number;
    uniqueCanonicalImageSlugs: number;
    exactMatches: number;
    aliasMatches: number;
    invalidFilenames: number;
    ambiguousAliases: number;
    duplicateFileNames: number;
    duplicateMediaIndexes: number;
    renameTargetConflicts: number;
    catalogExercisesWithoutMedia: number;
    imageSlugsWithoutCatalog: number;
    blockingErrors: number;
  };
  catalogSlugs: string[];
  catalogExercisesWithoutMedia: string[];
  imageSlugsWithoutCatalog: string[];
  multipleImageSlugs: Array<{ parsedSlug: string; indexes: number[] }>;
  multipleImageExercises: Array<{ canonicalSlug: string; indexes: number[] }>;
  aliases: Array<{ sourceSlug: string; canonicalSlug: string; reason: string }>;
  items: ExerciseMediaReconciliationItem[];
}

export type AliasResolution = string | readonly string[];

export function parseExerciseMediaFileName(fileName: string): ParsedExerciseMediaFile | null {
  if (!fileName || basename(fileName) !== fileName || fileName.includes('/') || fileName.includes('\\')) return null;
  const match = EXERCISE_MEDIA_FILE_PATTERN.exec(fileName);
  if (!match?.groups) return null;
  const index = Number(match.groups.index);
  if (!Number.isInteger(index) || index < 1) return null;
  return { fileName, parsedSlug: match.groups.slug, mediaType: 'ANATOMY', index };
}

export function reconcileExerciseMedia(options: {
  fileNames: string[];
  catalog: CatalogExerciseIdentity[];
  sourceDirectory: string;
  aliases?: Readonly<Record<string, AliasResolution>>;
  aliasReasons?: Readonly<Record<string, string>>;
}): ExerciseMediaReconciliationReport {
  const aliases = options.aliases ?? EXERCISE_MEDIA_SLUG_ALIASES;
  const aliasReasons = options.aliasReasons ?? EXERCISE_MEDIA_ALIAS_REASONS;
  const catalog = [...options.catalog].sort((a, b) => a.slug.localeCompare(b.slug));
  const catalogBySlug = new Map(catalog.map((item) => [item.slug, item] as const));
  const fileNameCounts = count(options.fileNames);

  const items = options.fileNames.map<ExerciseMediaReconciliationItem>((sourceFileName) => {
    if ((fileNameCounts.get(sourceFileName) ?? 0) > 1) {
      return invalidItem(sourceFileName, 'DUPLICATE_FILE_NAME', 'The source filename appears more than once.');
    }
    const parsed = parseExerciseMediaFileName(sourceFileName);
    if (!parsed) return invalidItem(sourceFileName, 'INVALID_FILENAME', 'Filename does not match the strict WebP anatomy convention.');
    const exact = catalogBySlug.get(parsed.parsedSlug);
    if (exact) return matchedItem(parsed, exact, 'EXACT_MATCH');

    const alias = aliases[parsed.parsedSlug];
    if (Array.isArray(alias)) {
      return {
        ...baseParsedItem(parsed),
        status: 'AMBIGUOUS_ALIAS',
        blockingReason: `Alias has multiple possible targets: ${[...alias].sort().join(', ')}.`
      };
    }
    if (typeof alias === 'string') {
      const target = catalogBySlug.get(alias);
      if (!target) {
        return {
          ...baseParsedItem(parsed),
          canonicalSlug: alias,
          canonicalFileName: canonicalFileName(alias, parsed.index),
          status: 'CATALOG_EXERCISE_MISSING',
          aliasReason: aliasReasons[parsed.parsedSlug],
          blockingReason: 'ALIAS_TARGET_MISSING'
        };
      }
      return matchedItem(parsed, target, 'ALIAS_MATCH', aliasReasons[parsed.parsedSlug] ?? 'Explicit reviewed alias.');
    }
    return {
      ...baseParsedItem(parsed),
      status: 'CATALOG_EXERCISE_MISSING',
      blockingReason: 'No exact catalog slug or explicit reviewed alias exists.'
    };
  });

  applyDuplicateMediaStatuses(items);
  applyRenameConflictStatuses(items, new Set(options.fileNames));
  items.sort(compareItems);

  const canonicalIndexes = new Map<string, number[]>();
  for (const item of items) {
    if (!item.canonicalSlug || item.mediaIndex == null || isBlockingItem(item)) continue;
    const indexes = canonicalIndexes.get(item.canonicalSlug) ?? [];
    indexes.push(item.mediaIndex);
    canonicalIndexes.set(item.canonicalSlug, indexes);
  }
  const canonicalImageSlugs = new Set(canonicalIndexes.keys());
  const catalogSlugs = catalog.map((item) => item.slug);
  const catalogExercisesWithoutMedia = catalogSlugs.filter((slug) => !canonicalImageSlugs.has(slug));
  const imageSlugsWithoutCatalog = [...new Set(items
    .filter((item) => item.status === 'CATALOG_EXERCISE_MISSING' && item.parsedSlug)
    .map((item) => item.parsedSlug!))].sort();
  const multipleImageExercises = [...canonicalIndexes.entries()]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([canonicalSlug, indexes]) => ({ canonicalSlug, indexes: [...indexes].sort((a, b) => a - b) }))
    .sort((a, b) => a.canonicalSlug.localeCompare(b.canonicalSlug));
  const parsedIndexes = new Map<string, number[]>();
  for (const item of items) {
    if (!item.parsedSlug || item.mediaIndex == null || item.status === 'INVALID_FILENAME' || item.status === 'DUPLICATE_FILE_NAME') continue;
    parsedIndexes.set(item.parsedSlug, [...(parsedIndexes.get(item.parsedSlug) ?? []), item.mediaIndex]);
  }
  const multipleImageSlugs = [...parsedIndexes.entries()]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([parsedSlug, indexes]) => ({ parsedSlug, indexes: [...indexes].sort((a, b) => a - b) }))
    .sort((a, b) => a.parsedSlug.localeCompare(b.parsedSlug));
  const blockingItemCount = items.filter(isBlockingItem).length;

  return {
    schemaVersion: 'exercise-media-reconciliation.v1',
    sourceDirectory: normalizeRelativePath(options.sourceDirectory),
    summary: {
      catalogExercises: catalog.length,
      sourceFiles: options.fileNames.length,
      uniqueParsedImageSlugs: new Set(items.flatMap((item) => item.parsedSlug ? [item.parsedSlug] : [])).size,
      uniqueCanonicalImageSlugs: canonicalImageSlugs.size,
      exactMatches: statusCount(items, 'EXACT_MATCH'),
      aliasMatches: statusCount(items, 'ALIAS_MATCH'),
      invalidFilenames: statusCount(items, 'INVALID_FILENAME'),
      ambiguousAliases: statusCount(items, 'AMBIGUOUS_ALIAS'),
      duplicateFileNames: statusCount(items, 'DUPLICATE_FILE_NAME'),
      duplicateMediaIndexes: statusCount(items, 'DUPLICATE_MEDIA_INDEX'),
      renameTargetConflicts: statusCount(items, 'RENAME_TARGET_CONFLICT'),
      catalogExercisesWithoutMedia: catalogExercisesWithoutMedia.length,
      imageSlugsWithoutCatalog: imageSlugsWithoutCatalog.length,
      blockingErrors: blockingItemCount
    },
    catalogSlugs,
    catalogExercisesWithoutMedia,
    imageSlugsWithoutCatalog,
    multipleImageSlugs,
    multipleImageExercises,
    aliases: Object.entries(aliases).flatMap(([sourceSlug, canonicalSlug]) => typeof canonicalSlug === 'string' ? [{ sourceSlug, canonicalSlug }] : [])
      .sort((a, b) => a.sourceSlug.localeCompare(b.sourceSlug)).map(({ sourceSlug, canonicalSlug }) => ({
      sourceSlug,
      canonicalSlug,
      reason: aliasReasons[sourceSlug] ?? 'Explicit reviewed alias.'
    })),
    items
  };
}

export async function readSourceFileNames(sourceDirectory: string) {
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase() !== 'readme.md')
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function writeReconciliationReports(report: ExerciseMediaReconciliationReport, jsonPath: string, markdownPath: string) {
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, toReconciliationMarkdown(report), 'utf8');
}

export async function applyAliasRenames(sourceDirectory: string, report: ExerciseMediaReconciliationReport) {
  if (report.summary.blockingErrors > 0) {
    throw new Error(`Apply blocked: reconciliation has ${report.summary.blockingErrors} blocking errors.`);
  }
  const aliases = report.items.filter((item) => item.status === 'ALIAS_MATCH');
  for (const item of aliases) {
    if (!item.canonicalFileName) throw new Error(`Apply blocked: ${item.sourceFileName} has no canonical filename.`);
    await rename(resolve(sourceDirectory, item.sourceFileName), resolve(sourceDirectory, item.canonicalFileName));
  }
  return aliases.map((item) => ({ from: item.sourceFileName, to: item.canonicalFileName! }));
}

export function toReconciliationMarkdown(report: ExerciseMediaReconciliationReport) {
  const summaryRows = Object.entries(report.summary).map(([key, value]) => `| ${key} | ${value} |`).join('\n');
  const aliasRows = report.aliases.map((item) => `| ${markdownCell(item.sourceSlug)} | ${markdownCell(item.canonicalSlug)} | ${markdownCell(item.reason)} |`).join('\n');
  const itemRows = report.items.map((item) => [
    item.sourceFileName,
    item.parsedSlug ?? '-',
    item.canonicalExerciseName ?? '-',
    item.canonicalSlug ?? '-',
    item.canonicalFileName ?? '-',
    item.status,
    item.status === 'ALIAS_MATCH' ? `Rename (${item.aliasReason})` : item.blockingReason ?? 'No rename'
  ].map(markdownCell).join(' | ')).map((row) => `| ${row} |`).join('\n');
  return `# Exercise media reconciliation\n\n` +
    `Source: \`${report.sourceDirectory}\`\n\n` +
    `The unmatched identity decisions are documented separately in [exercise-media-catalog-alignment.md](./exercise-media-catalog-alignment.md); this reconciliation baseline remains intentionally unchanged until product approval.\n\n` +
    `Exercise \`slug\` from the deterministic seed catalog is the only identity source. No fuzzy or AI matching is used.\n\n` +
    `Dry run: \`pnpm --filter @optime/api exercise-media:reconcile\`. Apply: \`pnpm --filter @optime/api exercise-media:reconcile -- --apply\`. Apply renames only reviewed aliases and refuses mutation while any filename blocker exists. Catalog exercises without media are supported text-only fallback states. Image bytes and database records are never modified.\n\n` +
    `## Summary\n\n| Metric | Count |\n| --- | ---: |\n${summaryRows}\n\n` +
    `## Coverage\n\nCatalog exercises without media: ${list(report.catalogExercisesWithoutMedia)}\n\n` +
    `Image slugs without catalog exercise: ${list(report.imageSlugsWithoutCatalog)}\n\n` +
    `Multiple source-image slugs: ${report.multipleImageSlugs.length ? report.multipleImageSlugs.map((item) => `${item.parsedSlug} (${item.indexes.join(', ')})`).join(', ') : 'None'}\n\n` +
    `Multiple matched catalog exercises: ${report.multipleImageExercises.length ? report.multipleImageExercises.map((item) => `${item.canonicalSlug} (${item.indexes.join(', ')})`).join(', ') : 'None'}\n\n` +
    `Ingestion readiness: **${report.summary.blockingErrors === 0 ? 'READY' : 'BLOCKED'}**\n\n` +
    `## Explicit reviewed aliases\n\n| Source slug | Canonical slug | Reason |\n| --- | --- | --- |\n${aliasRows || '| None | None | None |'}\n\n` +
    `## Items\n\n| Source filename | Parsed slug | Canonical exercise | Canonical slug | Canonical filename | Status | Action |\n| --- | --- | --- | --- | --- | --- | --- |\n${itemRows}\n`;
}

function matchedItem(parsed: ParsedExerciseMediaFile, target: CatalogExerciseIdentity, status: 'EXACT_MATCH' | 'ALIAS_MATCH', aliasReason?: string): ExerciseMediaReconciliationItem {
  return {
    ...baseParsedItem(parsed),
    canonicalExerciseName: target.name,
    canonicalSlug: target.slug,
    canonicalFileName: canonicalFileName(target.slug, parsed.index),
    status,
    ...(aliasReason ? { aliasReason } : {})
  };
}

function baseParsedItem(parsed: ParsedExerciseMediaFile): ExerciseMediaReconciliationItem {
  return {
    sourceFileName: parsed.fileName,
    parsedSlug: parsed.parsedSlug,
    mediaIndex: parsed.index,
    canonicalExerciseName: null,
    canonicalSlug: null,
    canonicalFileName: null,
    status: 'CATALOG_EXERCISE_MISSING'
  };
}

function invalidItem(sourceFileName: string, status: 'INVALID_FILENAME' | 'DUPLICATE_FILE_NAME', blockingReason: string): ExerciseMediaReconciliationItem {
  return { sourceFileName, parsedSlug: null, mediaIndex: null, canonicalExerciseName: null, canonicalSlug: null, canonicalFileName: null, status, blockingReason };
}

function applyDuplicateMediaStatuses(items: ExerciseMediaReconciliationItem[]) {
  const groups = new Map<string, ExerciseMediaReconciliationItem[]>();
  for (const item of items) {
    if (!item.canonicalSlug || item.mediaIndex == null || item.status === 'DUPLICATE_FILE_NAME') continue;
    const key = `${item.canonicalSlug}:${item.mediaIndex}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    for (const item of group) {
      item.status = 'DUPLICATE_MEDIA_INDEX';
      item.blockingReason = `Duplicate canonical media identity ${key}.`;
    }
  }
}

function applyRenameConflictStatuses(items: ExerciseMediaReconciliationItem[], sourceFileNames: Set<string>) {
  const targets = new Map<string, ExerciseMediaReconciliationItem[]>();
  for (const item of items.filter((candidate) => candidate.canonicalFileName && candidate.parsedSlug !== candidate.canonicalSlug && candidate.status !== 'CATALOG_EXERCISE_MISSING')) {
    targets.set(item.canonicalFileName!, [...(targets.get(item.canonicalFileName!) ?? []), item]);
  }
  for (const [target, group] of targets) {
    const destinationExists = sourceFileNames.has(target) && group.every((item) => item.sourceFileName !== target);
    if (!destinationExists) continue;
    for (const item of group) {
      item.status = 'RENAME_TARGET_CONFLICT';
      item.blockingReason = `Rename destination already exists or is targeted more than once: ${target}.`;
    }
  }
}

function isBlockingItem(item: ExerciseMediaReconciliationItem) {
  return item.status !== 'EXACT_MATCH' && item.status !== 'ALIAS_MATCH';
}

function canonicalFileName(slug: string, index: number) {
  return `${slug}_anatomy-${String(index).padStart(2, '0')}.webp`;
}

function count(values: string[]) {
  const result = new Map<string, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

function statusCount(items: ExerciseMediaReconciliationItem[], status: ReconciliationStatus) {
  return items.filter((item) => item.status === status).length;
}

function compareItems(a: ExerciseMediaReconciliationItem, b: ExerciseMediaReconciliationItem) {
  return (a.canonicalSlug ?? a.parsedSlug ?? a.sourceFileName).localeCompare(b.canonicalSlug ?? b.parsedSlug ?? b.sourceFileName)
    || (a.mediaIndex ?? 0) - (b.mediaIndex ?? 0)
    || a.sourceFileName.localeCompare(b.sourceFileName);
}

function normalizeRelativePath(path: string) {
  return path.split(sep).join('/').replace(/^\.\//, '');
}

function markdownCell(value: string) {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function list(values: string[]) {
  return values.length ? values.map((value) => `\`${value}\``).join(', ') : 'None';
}
