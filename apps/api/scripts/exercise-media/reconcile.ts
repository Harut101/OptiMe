import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { exerciseCatalog } from '../../prisma/seeds/exercises';
import {
  applyAliasRenames,
  EXERCISE_MEDIA_ALIAS_REASONS,
  EXERCISE_MEDIA_SLUG_ALIASES,
  readSourceFileNames,
  reconcileExerciseMedia,
  writeReconciliationReports
} from './reconciliation';
import type { ExerciseMediaCatalogAlignmentReport } from './catalog-alignment';

const workspaceRoot = resolve(__dirname, '../../../..');
const sourceDirectory = resolve(workspaceRoot, 'apps/mobile/assets/exercise-media/inbox');
const jsonReportPath = resolve(workspaceRoot, 'apps/mobile/assets/exercise-media/exercise-media-reconciliation.json');
const markdownReportPath = resolve(workspaceRoot, 'docs/exercise-media-reconciliation.md');
const alignmentReportPath = resolve(workspaceRoot, 'apps/mobile/assets/exercise-media/exercise-media-catalog-alignment.json');
const sourceRelative = relative(workspaceRoot, sourceDirectory);
const apply = process.argv.includes('--apply');

async function createReport() {
  const fileNames = await readSourceFileNames(sourceDirectory);
  const approved = await readApprovedAlignmentAliases();
  return reconcileExerciseMedia({
    fileNames,
    sourceDirectory: sourceRelative,
    aliases: { ...EXERCISE_MEDIA_SLUG_ALIASES, ...approved.aliases },
    aliasReasons: { ...EXERCISE_MEDIA_ALIAS_REASONS, ...approved.reasons },
    catalog: exerciseCatalog.map((exercise) => ({
      slug: exercise.slug,
      name: exercise.translations.find((translation) => translation.locale === 'en-US')?.name ?? exercise.slug
    }))
  });
}

async function readApprovedAlignmentAliases() {
  const report = JSON.parse(await readFile(alignmentReportPath, 'utf8')) as ExerciseMediaCatalogAlignmentReport;
  const aliases: Record<string, string> = {};
  const reasons: Record<string, string> = {};
  for (const item of report.items) {
    const target = item.proposedCanonicalSlug;
    if (!target || target === item.imageSlug) continue;
    if (item.status !== 'SAFE_ALIAS' && item.status !== 'NEW_EXERCISE_CANDIDATE') continue;
    aliases[item.imageSlug] = target;
    reasons[item.imageSlug] = item.status === 'SAFE_ALIAS'
      ? item.reason
      : `Approved catalog expansion canonical slug for ${item.imageSlug}.`;
  }
  if (aliases['barbell-hip-thrust'] === 'hip-thrust') {
    throw new Error('Forbidden alias detected: barbell-hip-thrust must not map to hip-thrust.');
  }
  return { aliases, reasons };
}

async function main() {
  let report = await createReport();
  await writeReconciliationReports(report, jsonReportPath, markdownReportPath);
  printSummary(report, 'Dry-run reconciliation');
  if (!apply) return;

  const renames = await applyAliasRenames(sourceDirectory, report);
  for (const item of renames) console.log(`Renamed: ${item.from} -> ${item.to}`);
  report = await createReport();
  await writeReconciliationReports(report, jsonReportPath, markdownReportPath);
  if (report.summary.aliasMatches || report.summary.blockingErrors) {
    throw new Error('Post-apply reconciliation did not reach an exact, zero-blocker state.');
  }
  printSummary(report, 'Post-apply reconciliation');
}

function printSummary(report: Awaited<ReturnType<typeof createReport>>, heading: string) {
  console.log(heading);
  console.log(`Source directory: ${report.sourceDirectory}`);
  for (const [key, value] of Object.entries(report.summary)) console.log(`${key}: ${value}`);
  console.log(`JSON report: apps/mobile/assets/exercise-media/exercise-media-reconciliation.json`);
  console.log(`Markdown report: docs/exercise-media-reconciliation.md`);
  console.log(report.summary.blockingErrors ? 'ExerciseMedia ingestion is blocked.' : 'ExerciseMedia ingestion filename coverage is ready.');
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
