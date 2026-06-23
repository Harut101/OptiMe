import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { validateExerciseMediaAssets } from '../scripts/exercise-media/media-manifest';

const normalizedFiles = [
  'barbell-hip-thrust_anatomy-01.webp',
  'bodyweight-squat_anatomy-01.webp',
  'cable-triceps-pushdown_anatomy-01.webp',
  'quadruped-leg-kickback_anatomy-01.webp',
  'standing-barbell-calf-raise_anatomy-01.webp'
] as const;

describe('Exercise media validation', () => {
  it('accepts all approved source media and keeps normalized blockers at exact 4:5', async () => {
    const report = await validateExerciseMediaAssets();

    expect(report.summary).toMatchObject({
      sourceFiles: 47,
      manifestItems: 47,
      mediaCoveredExercises: 46,
      fallbackOnlyExercises: 31,
      validationFailures: 0
    });
    expect(report.failures).toEqual([]);

    for (const fileName of normalizedFiles) {
      expect(report.manifest.find((item) => item.sourceFileName === fileName)).toMatchObject({
        sourceFileName: fileName,
        width: 1200,
        height: 1500,
        type: 'ANATOMY',
        isActive: true
      });
    }
  });

  it('keeps private backups and previews outside the ExerciseMedia manifest', async () => {
    const report = await validateExerciseMediaAssets();
    const manifestPaths = report.manifest.flatMap((item) => [item.sourceFileName, item.destinationFileName, item.relativeUrl]);

    expect(manifestPaths.some((value) => value.includes('source-originals'))).toBe(false);
    expect(manifestPaths.some((value) => value.includes('previews'))).toBe(false);

    for (const fileName of normalizedFiles) {
      await expect(access(resolve(__dirname, '../../mobile/assets/exercise-media/source-originals/blocked-2x3', fileName))).resolves.toBeUndefined();
    }
    await expect(access(resolve(__dirname, '../../mobile/assets/exercise-media/previews/normalized-4x5/normalized-4x5-contact-sheet.webp'))).resolves.toBeUndefined();
  });

  it('preserves Russian Twist ordering and separate hip thrust identities', async () => {
    const report = await validateExerciseMediaAssets();
    const russianTwist = report.manifest.filter((item) => item.exerciseSlug === 'russian-twist');
    const hipThrust = report.manifest.filter((item) => item.exerciseSlug === 'hip-thrust');
    const barbellHipThrust = report.manifest.filter((item) => item.exerciseSlug === 'barbell-hip-thrust');

    expect(russianTwist.map((item) => ({ file: item.destinationFileName, isPrimary: item.isPrimary, sortOrder: item.sortOrder }))).toEqual([
      { file: 'russian-twist_anatomy-01.webp', isPrimary: true, sortOrder: 0 },
      { file: 'russian-twist_anatomy-02.webp', isPrimary: false, sortOrder: 1 }
    ]);
    expect(hipThrust).toHaveLength(1);
    expect(hipThrust[0]).toMatchObject({ destinationFileName: 'hip-thrust_anatomy-01.webp', isPrimary: true, sortOrder: 0 });
    expect(barbellHipThrust).toHaveLength(1);
    expect(barbellHipThrust[0]).toMatchObject({ destinationFileName: 'barbell-hip-thrust_anatomy-01.webp', isPrimary: true, sortOrder: 0 });
  });

  it('does not include stale temporary WebP artifacts in the inbox', async () => {
    const report = await validateExerciseMediaAssets();
    const validationJson = await readFile(resolve(__dirname, '../../mobile/assets/exercise-media/exercise-media-validation.json'), 'utf8');

    expect(report.manifest.some((item) => item.sourceFileName.includes('.tmp-'))).toBe(false);
    expect(validationJson).not.toContain('.tmp-');
  });
});
