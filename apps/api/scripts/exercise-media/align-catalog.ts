import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { baseExerciseCatalog } from '../../prisma/seeds/exercises';
import {
  buildCatalogAlignmentReport,
  toCatalogAlignmentMarkdown
} from './catalog-alignment';
import type { ExerciseMediaReconciliationReport } from './reconciliation';

async function main() {
  const workspaceRoot = resolve(process.cwd(), '../..');
  const reconciliationPath = resolve(workspaceRoot, 'apps/mobile/assets/exercise-media/exercise-media-reconciliation.json');
  const jsonPath = resolve(workspaceRoot, 'apps/mobile/assets/exercise-media/exercise-media-catalog-alignment.json');
  const markdownPath = resolve(workspaceRoot, 'docs/exercise-media-catalog-alignment.md');
  const reconciliation = JSON.parse(await readFile(reconciliationPath, 'utf8')) as ExerciseMediaReconciliationReport;
  const report = buildCatalogAlignmentReport(reconciliation, baseExerciseCatalog);

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, toCatalogAlignmentMarkdown(report), 'utf8');
  process.stdout.write(`Classified ${report.summary.classifiedUnmatchedIdentities} unmatched exercise-media identities.\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
