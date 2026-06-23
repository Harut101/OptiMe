import { validateExerciseMediaAssets } from './media-manifest';

async function main() {
  const report = await validateExerciseMediaAssets();
  for (const [key, value] of Object.entries(report.summary)) console.log(`${key}: ${value}`);
  if (report.failures.length) {
    for (const failure of report.failures) {
      console.log(`${failure.reasonCode}: ${failure.filename} (${failure.parsedSlug ?? 'unparsed'}) - ${failure.explanation}`);
    }
    throw new Error(`ExerciseMedia validation failed with ${report.failures.length} blocker(s).`);
  }
  console.log('ExerciseMedia validation passed.');
  console.log('Manifest: apps/mobile/assets/exercise-media/exercise-media-manifest.json');
  console.log('Validation report: apps/mobile/assets/exercise-media/exercise-media-validation.json');
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
