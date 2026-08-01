import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';

export async function writeAiReleaseReport(
  configuredPath: string | undefined,
  report: unknown
) {
  const reportPath = configuredPath?.trim();
  if (!reportPath) {
    throw new Error(
      'AI_RELEASE_REPORT_PATH is required for ai-release:monitor.'
    );
  }
  if (extname(reportPath).toLowerCase() !== '.json') {
    throw new Error('AI_RELEASE_REPORT_PATH must end with .json.');
  }

  const absolutePath = resolve(reportPath);
  const temporaryPath = `${absolutePath}.${process.pid}.tmp`;
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx'
  });
  await rename(temporaryPath, absolutePath);

  return absolutePath;
}
