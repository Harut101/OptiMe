import { buildThumbnailReport } from './thumbnails-manifest';

const apply = process.argv.includes('--apply');

void buildThumbnailReport({ apply }).then((report) => {
  console.log(apply ? 'Applied exercise-media thumbnails' : 'Dry-run exercise-media thumbnails');
  console.log(`fullMediaItems: ${report.summary.fullMediaItems}`);
  console.log(`thumbnails: ${report.summary.thumbnails}`);
  console.log(`generated: ${report.summary.generated ?? 0}`);
  console.log(`skipped: ${report.summary.skipped ?? 0}`);
  console.log(`generationRequired: ${report.summary.generationRequired ?? 0}`);
  console.log(`validationFailures: ${report.summary.validationFailures}`);
  console.log(`totalFullBytes: ${report.summary.totalFullBytes}`);
  console.log(`totalThumbnailBytes: ${report.summary.totalThumbnailBytes ?? 0}`);
  console.log(`estimatedListViewTransferReductionPercent: ${report.summary.estimatedListViewTransferReductionPercent ?? 0}`);
  for (const failure of report.failures) console.log(`${failure.reasonCode}: ${failure.seedKey} - ${failure.explanation}`);
  console.log(apply
    ? 'Thumbnail report: apps/mobile/assets/exercise-media/exercise-media-thumbnails.json'
    : 'Thumbnail report: not written during dry run');
  if (report.failures.length) process.exitCode = 1;
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
