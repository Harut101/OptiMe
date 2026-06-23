import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  ALIGNMENT_STATUSES,
  buildCatalogAlignmentReport,
  toCatalogAlignmentMarkdown
} from '../scripts/exercise-media/catalog-alignment';
import type { ExerciseMediaCatalogAlignmentReport } from '../scripts/exercise-media/catalog-alignment';
import { baseExerciseCatalog } from '../prisma/seeds/exercises';
import type { ExerciseMediaReconciliationReport } from '../scripts/exercise-media/reconciliation';
import {
  EXERCISE_CATEGORIES,
  EXERCISE_EQUIPMENT,
  MOVEMENT_PATTERNS,
  SUPPORTED_LOCALES,
  TARGET_MUSCLE_GROUPS,
  TRAINING_LEVELS
} from '@optime/shared-types';

const workspaceRoot = resolve(__dirname, '../../..');
const reconciliationPath = resolve(workspaceRoot, 'apps/mobile/assets/exercise-media/exercise-media-reconciliation.json');
const alignmentJsonPath = resolve(workspaceRoot, 'apps/mobile/assets/exercise-media/exercise-media-catalog-alignment.json');
const alignmentMarkdownPath = resolve(workspaceRoot, 'docs/exercise-media-catalog-alignment.md');
const sourceDirectory = resolve(workspaceRoot, 'apps/mobile/assets/exercise-media/inbox');
const alignmentSourcePath = resolve(workspaceRoot, 'apps/api/scripts/exercise-media/catalog-alignment.ts');

describe('Exercise media catalog alignment', () => {
  let reconciliation: ExerciseMediaReconciliationReport;

  beforeAll(async () => {
    const current = JSON.parse(await readFile(reconciliationPath, 'utf8')) as ExerciseMediaReconciliationReport;
    const alignment = JSON.parse(await readFile(alignmentJsonPath, 'utf8')) as ExerciseMediaCatalogAlignmentReport;
    const baseSlugs = new Set(baseExerciseCatalog.map((item) => item.slug));
    reconciliation = {
      ...current,
      imageSlugsWithoutCatalog: alignment.items.map((item) => item.imageSlug).sort(),
      items: [
        ...current.items.filter((item) => item.parsedSlug && baseSlugs.has(item.parsedSlug)).map((item) => ({
          ...item,
          canonicalSlug: item.parsedSlug,
          status: 'EXACT_MATCH' as const
        })),
        ...alignment.items.flatMap((item) => item.sourceFiles.map((sourceFileName) => ({
          sourceFileName,
          parsedSlug: item.imageSlug,
          mediaIndex: Number(sourceFileName.match(/_anatomy-(\d{2})\.webp$/)?.[1] ?? 1),
          canonicalExerciseName: null,
          canonicalSlug: null,
          canonicalFileName: null,
          status: 'CATALOG_EXERCISE_MISSING' as const,
          blockingReason: 'Approved review package identity.'
        })))
      ]
    };
  });

  it('classifies every unmatched reconciliation identity exactly once', () => {
    const report = buildCatalogAlignmentReport(reconciliation, baseExerciseCatalog);
    expect(report.items).toHaveLength(33);
    expect(report.summary.classifiedUnmatchedIdentities).toBe(reconciliation.imageSlugsWithoutCatalog.length);
    expect(report.items.map((item) => item.imageSlug)).toEqual([...reconciliation.imageSlugsWithoutCatalog].sort());
    expect(new Set(report.items.map((item) => item.imageSlug)).size).toBe(report.items.length);
    expect(report.items.every((item) => ALIGNMENT_STATUSES.includes(item.status))).toBe(true);
  });

  it('keeps aliases valid and new candidates collision-free with complete localized metadata', () => {
    const report = buildCatalogAlignmentReport(reconciliation, baseExerciseCatalog);
    const catalogSlugs = new Set(baseExerciseCatalog.map((item) => item.slug));
    const validEnums = {
      category: new Set<string>(EXERCISE_CATEGORIES),
      movement: new Set<string>(MOVEMENT_PATTERNS),
      equipment: new Set<string>(EXERCISE_EQUIPMENT),
      level: new Set<string>(TRAINING_LEVELS),
      muscle: new Set<string>(TARGET_MUSCLE_GROUPS)
    };
    for (const item of report.items) {
      if (item.status === 'SAFE_ALIAS') expect(catalogSlugs.has(item.existingExerciseSlug!)).toBe(true);
      if (!item.proposedExercise) continue;
      const proposal = item.proposedExercise;
      expect(proposal.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(catalogSlugs.has(proposal.slug)).toBe(false);
      expect(validEnums.category.has(proposal.category)).toBe(true);
      expect(validEnums.movement.has(proposal.movementPattern)).toBe(true);
      expect(proposal.equipment.every((value) => validEnums.equipment.has(value))).toBe(true);
      expect(proposal.levels.every((value) => validEnums.level.has(value))).toBe(true);
      expect([...proposal.primaryMuscles, ...proposal.secondaryMuscles].every((value) => validEnums.muscle.has(value))).toBe(true);
      expect(Object.keys(proposal.translations).sort()).toEqual([...SUPPORTED_LOCALES].sort());
      expect(SUPPORTED_LOCALES.every((locale) => proposal.translations[locale].trim().length > 0)).toBe(true);
    }
  });

  it('treats Russian Twist as one candidate with two ordered source media files', () => {
    const report = buildCatalogAlignmentReport(reconciliation, baseExerciseCatalog);
    const russianTwist = report.items.filter((item) => item.imageSlug === 'russian-twist');
    expect(russianTwist).toHaveLength(1);
    expect(russianTwist[0]).toMatchObject({ status: 'NEW_EXERCISE_CANDIDATE', proposedCanonicalSlug: 'russian-twist' });
    expect(russianTwist[0].sourceFiles).toEqual(['russian-twist_anatomy-01.webp', 'russian-twist_anatomy-02.webp']);
  });

  it('keeps Hip Thrust and Barbell Hip Thrust as separate media identities', () => {
    const report = buildCatalogAlignmentReport(reconciliation, baseExerciseCatalog);
    const barbellHipThrust = report.items.find((item) => item.imageSlug === 'barbell-hip-thrust');
    const safeAliases = report.items.filter((item) => item.status === 'SAFE_ALIAS').map((item) => item.imageSlug);
    const existingHipThrust = baseExerciseCatalog.find((item) => item.slug === 'hip-thrust');

    expect(existingHipThrust).toBeDefined();
    expect(barbellHipThrust).toBeDefined();
    expect(barbellHipThrust).toMatchObject({
      status: 'NEW_EXERCISE_CANDIDATE',
      proposedCanonicalSlug: 'barbell-hip-thrust',
      existingExerciseSlug: null,
      proposedAction: 'ADD_NEW_EXERCISE'
    });
    expect(safeAliases).not.toContain('barbell-hip-thrust');
    expect(barbellHipThrust!.sourceFiles).toEqual(['barbell-hip-thrust_anatomy-01.webp']);
    expect(barbellHipThrust!.closestExistingExercise?.slug).toBe('hip-thrust');
    expect(barbellHipThrust!.proposedExercise).toMatchObject({
      slug: 'barbell-hip-thrust',
      canonicalEnglishName: 'Barbell Hip Thrust',
      category: 'STRENGTH',
      movementPattern: 'HINGE',
      equipment: ['BENCH', 'BARBELL'],
      levels: ['INTERMEDIATE', 'ADVANCED'],
      primaryMuscles: ['GLUTES'],
      secondaryMuscles: ['HAMSTRINGS'],
      isUnilateral: false,
      isActive: true
    });
    expect(barbellHipThrust!.proposedExercise!.bodyPosition).toContain('loaded barbell');
    expect(barbellHipThrust!.differencesFromClosestExercise.join(' ')).toMatch(/barbell loading|external load placement|Progression options/);
    expect(existingHipThrust!.slug).toBe('hip-thrust');
    expect(existingHipThrust!.equipment).toEqual(['BENCH', 'BARBELL']);
    expect(barbellHipThrust!.proposedExercise!.rationale).toContain('without changing the existing hip-thrust exercise');
  });

  it('produces deterministic reports without absolute machine paths', () => {
    const first = buildCatalogAlignmentReport(reconciliation, baseExerciseCatalog);
    const second = buildCatalogAlignmentReport(reconciliation, baseExerciseCatalog);
    expect(JSON.stringify(second, null, 2)).toBe(JSON.stringify(first, null, 2));
    expect(toCatalogAlignmentMarkdown(second)).toBe(toCatalogAlignmentMarkdown(first));
    expect(JSON.stringify(first)).not.toMatch(/[A-Z]:\\|\/Users\//);
    expect(toCatalogAlignmentMarkdown(first)).not.toMatch(/[A-Z]:\\|\/Users\//);
    expect(JSON.stringify(first)).not.toContain('hip-thrust_anatomy-02.webp');
    expect(toCatalogAlignmentMarkdown(first)).not.toContain('hip-thrust_anatomy-02.webp');
  });

  it('keeps committed JSON and Markdown synchronized with the deterministic generator', async () => {
    const report = buildCatalogAlignmentReport(reconciliation, baseExerciseCatalog);
    expect(await readFile(alignmentJsonPath, 'utf8')).toBe(`${JSON.stringify(report, null, 2)}\n`);
    expect(await readFile(alignmentMarkdownPath, 'utf8')).toBe(toCatalogAlignmentMarkdown(report));
  });

  it('does not rename source media or contain database/OpenAI mutation paths', async () => {
    const before = (await readdir(sourceDirectory)).sort();
    buildCatalogAlignmentReport(reconciliation, baseExerciseCatalog);
    const after = (await readdir(sourceDirectory)).sort();
    expect(after).toEqual(before);
    const source = await readFile(alignmentSourcePath, 'utf8');
    expect(source).not.toMatch(/@prisma\/client|PrismaService|\.create\(|\.update\(|\.delete\(|from ['"]openai['"]|new OpenAI|rename\(/);
  });

  it('reports the projected expansion and coverage arithmetic explicitly', () => {
    const report = buildCatalogAlignmentReport(reconciliation, baseExerciseCatalog);
    const proposedNewExercises = report.items.filter((item) => item.status === 'NEW_EXERCISE_CANDIDATE').length;
    const safeAliases = report.items.filter((item) => item.status === 'SAFE_ALIAS').length;
    const projectedCatalogSize = baseExerciseCatalog.length + proposedNewExercises;
    const projectedMediaCoveredExercises = projectedCatalogSize - report.summary.remainingCatalogExercisesWithoutMedia;
    expect(report.summary).toEqual({
      currentCatalogExercises: 46,
      classifiedUnmatchedIdentities: 33,
      safeAliases,
      proposedNewExercises,
      duplicateExercises: 0,
      excludedMediaIdentities: 0,
      ambiguousIdentities: 0,
      projectedCatalogSize,
      projectedMediaCoveredExercises,
      remainingCatalogExercisesWithoutMedia: 31
    });
    expect(report.summary.safeAliases).toBe(2);
    expect(report.summary.proposedNewExercises).toBe(31);
    expect(report.summary.projectedCatalogSize).toBe(77);
    expect(report.summary.projectedMediaCoveredExercises).toBe(46);
    expect(report.summary.projectedCatalogSize * SUPPORTED_LOCALES.length).toBe(308);
  });
});
