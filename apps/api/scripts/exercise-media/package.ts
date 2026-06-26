import { packageExerciseMedia, packageManifestPath, packageRoot } from './thumbnails-manifest';

void packageExerciseMedia().then((report) => {
  console.log('ExerciseMedia package complete');
  console.log(`fullMedia: ${report.summary.fullMedia}`);
  console.log(`thumbnails: ${report.summary.thumbnails}`);
  console.log(`totalFiles: ${report.summary.totalFiles}`);
  console.log(`totalBytes: ${report.summary.totalBytes}`);
  console.log(`Package root: ${packageRoot}`);
  console.log(`Manifest: ${packageManifestPath}`);
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
