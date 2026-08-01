import { readFileSync } from 'node:fs';

import {
  assertComparableBenchmarkReport,
  compareBenchmarkReports
} from './ai-live-benchmark-report';

const [baselinePath, currentPath] = process.argv.slice(2);

if (!baselinePath || !currentPath) {
  throw new Error(
    'Usage: ai-release:compare -- <baseline-report.json> <current-report.json>'
  );
}

const baseline = readReport(baselinePath, 'Baseline report');
const current = readReport(currentPath, 'Current report');
process.stdout.write(
  `${JSON.stringify(compareBenchmarkReports(baseline, current), null, 2)}\n`
);

function readReport(path: string, source: string) {
  const report: unknown = JSON.parse(readFileSync(path, 'utf8'));
  assertComparableBenchmarkReport(report, source);
  return report;
}
