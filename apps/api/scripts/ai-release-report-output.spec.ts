import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { writeAiReleaseReport } from './ai-release-report-output';

describe('AI release report output', () => {
  it('writes a JSON report and creates its parent directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'optime-ai-release-'));
    const reportPath = join(root, 'nested', 'current.json');

    try {
      await writeAiReleaseReport(reportPath, {
        reportSchemaVersion: 'ai-release-monitor.v1',
        status: 'INSUFFICIENT_DATA'
      });
      await writeAiReleaseReport(reportPath, {
        reportSchemaVersion: 'ai-release-monitor.v1',
        status: 'PASS'
      });

      expect(JSON.parse(await readFile(reportPath, 'utf8'))).toEqual({
        reportSchemaVersion: 'ai-release-monitor.v1',
        status: 'PASS'
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('requires an explicit JSON output path', async () => {
    await expect(writeAiReleaseReport(undefined, {})).rejects.toThrow(
      'AI_RELEASE_REPORT_PATH is required'
    );
    await expect(writeAiReleaseReport('report.txt', {})).rejects.toThrow(
      'AI_RELEASE_REPORT_PATH must end with .json'
    );
  });
});
