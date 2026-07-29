import {
  packageManifestPath,
  packageRoot,
  validateExerciseMediaPackage
} from './thumbnails-manifest';

void validateExerciseMediaPackage().then((report) => {
  console.log('ExerciseMedia deployment package validation complete');
  console.log(`fullMedia: ${report.summary.fullMedia}`);
  console.log(`thumbnails: ${report.summary.thumbnails}`);
  console.log(`webpFiles: ${report.summary.webpFiles}`);
  console.log(`jpegFallbackFiles: ${report.summary.jpegFallbackFiles}`);
  console.log(`totalFiles: ${report.summary.totalFiles}`);
  console.log(`totalBytes: ${report.summary.totalBytes}`);
  console.log(`validationFailures: ${report.summary.validationFailures}`);
  console.log(`Package root: ${packageRoot}`);
  console.log(`Manifest: ${packageManifestPath}`);

  for (const failure of report.failures) {
    console.error(`${failure.reasonCode}: ${failure.relativePath}: ${failure.explanation}`);
  }
  if (report.failures.length) process.exitCode = 1;
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
