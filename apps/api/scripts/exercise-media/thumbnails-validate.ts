import { validateThumbnails } from './thumbnails-manifest';

void validateThumbnails().then((report) => {
  console.log('ExerciseMedia thumbnail validation');
  console.log(`fullMediaItems: ${report.summary.fullMediaItems}`);
  console.log(`thumbnails: ${report.summary.thumbnails}`);
  console.log(`validationFailures: ${report.summary.validationFailures}`);
  console.log(`minThumbnailBytes: ${report.summary.minThumbnailBytes ?? 0}`);
  console.log(`medianThumbnailBytes: ${report.summary.medianThumbnailBytes ?? 0}`);
  console.log(`maxThumbnailBytes: ${report.summary.maxThumbnailBytes ?? 0}`);
  console.log(`totalFullBytes: ${report.summary.totalFullBytes}`);
  console.log(`totalThumbnailBytes: ${report.summary.totalThumbnailBytes ?? 0}`);
  console.log(`estimatedListViewTransferReductionPercent: ${report.summary.estimatedListViewTransferReductionPercent ?? 0}`);
  console.log(`exerciseMediaRows: ${report.summary.exerciseMediaRows ?? 'unknown'}`);
  console.log(`exerciseMediaTranslationRows: ${report.summary.exerciseMediaTranslationRows ?? 'unknown'}`);
  for (const failure of report.failures) console.log(`${failure.reasonCode}: ${failure.seedKey} - ${failure.explanation}`);
  if (report.failures.length) process.exitCode = 1;
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
