import { ingestExerciseMediaAssets } from './media-manifest';

async function main() {
  const report = await ingestExerciseMediaAssets();
  for (const [key, value] of Object.entries(report.summary)) console.log(`${key}: ${value}`);
  console.log('ExerciseMedia ingestion complete.');
  console.log('Static destination: apps/api/public/exercise-media');
  console.log('Manifest: apps/mobile/assets/exercise-media/exercise-media-manifest.json');
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
