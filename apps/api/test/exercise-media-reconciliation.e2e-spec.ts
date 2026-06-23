import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  applyAliasRenames,
  parseExerciseMediaFileName,
  reconcileExerciseMedia,
  toReconciliationMarkdown,
  writeReconciliationReports
} from '../scripts/exercise-media/reconciliation';

const catalog = (slugs: string[]) => slugs.map((slug) => ({ slug, name: slug.replace(/-/g, ' ') }));

describe('Exercise media filename reconciliation', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  });

  it.each([
    ['push-up_anatomy-01.webp', 'push-up', 1],
    ['russian-twist_anatomy-02.webp', 'russian-twist', 2],
    ['mini-loop-band_anatomy-10.webp', 'mini-loop-band', 10]
  ])('strictly parses %s', (fileName, parsedSlug, index) => {
    expect(parseExerciseMediaFileName(fileName)).toEqual({ fileName, parsedSlug, mediaType: 'ANATOMY', index });
  });

  it.each([
    'Push-Up_anatomy-01.webp',
    'push_up_anatomy-01.webp',
    'push-up-anatomy-01.webp',
    'push-up_anatomy-1.webp',
    'push-up_anatomy-001.webp',
    'push-up_anatomy-00.webp',
    'push-up_anatomy-01.png',
    '../push-up_anatomy-01.webp',
    'nested/push-up_anatomy-01.webp',
    ''
  ])('rejects invalid filename %s', (fileName) => {
    expect(parseExerciseMediaFileName(fileName)).toBeNull();
  });

  it('reports exact, alias, missing coverage, two valid indexes, and deterministic sorting', () => {
    const report = reconcileExerciseMedia({
      fileNames: ['multi_anatomy-02.webp', 'unknown_anatomy-01.webp', 'alias_anatomy-01.webp', 'exact_anatomy-01.webp', 'multi_anatomy-01.webp'],
      catalog: catalog(['exact', 'canonical', 'multi', 'without-media']),
      sourceDirectory: 'assets/exercise-media/inbox',
      aliases: { alias: 'canonical' },
      aliasReasons: { alias: 'Reviewed test alias.' }
    });

    expect(report.summary).toMatchObject({ exactMatches: 3, aliasMatches: 1, imageSlugsWithoutCatalog: 1, catalogExercisesWithoutMedia: 1, duplicateMediaIndexes: 0 });
    expect(report.multipleImageSlugs).toEqual([{ parsedSlug: 'multi', indexes: [1, 2] }]);
    expect(report.multipleImageExercises).toEqual([{ canonicalSlug: 'multi', indexes: [1, 2] }]);
    expect(report.items.map((item) => item.sourceFileName)).toEqual([
      'alias_anatomy-01.webp', 'exact_anatomy-01.webp', 'multi_anatomy-01.webp', 'multi_anatomy-02.webp', 'unknown_anatomy-01.webp'
    ]);
  });

  it('blocks missing alias targets, ambiguous aliases, duplicate identities, and rename conflicts', () => {
    const missingTarget = reconcileExerciseMedia({
      fileNames: ['alias_anatomy-01.webp'], catalog: catalog(['other']), sourceDirectory: 'inbox', aliases: { alias: 'missing' }
    });
    expect(missingTarget.items[0]).toMatchObject({ status: 'CATALOG_EXERCISE_MISSING', blockingReason: 'ALIAS_TARGET_MISSING' });

    const ambiguous = reconcileExerciseMedia({
      fileNames: ['alias_anatomy-01.webp'], catalog: catalog(['one', 'two']), sourceDirectory: 'inbox', aliases: { alias: ['one', 'two'] }
    });
    expect(ambiguous.items[0].status).toBe('AMBIGUOUS_ALIAS');

    const duplicate = reconcileExerciseMedia({
      fileNames: ['alias-one_anatomy-01.webp', 'alias-two_anatomy-01.webp'], catalog: catalog(['canonical']), sourceDirectory: 'inbox', aliases: { 'alias-one': 'canonical', 'alias-two': 'canonical' }
    });
    expect(duplicate.items.every((item) => item.status === 'DUPLICATE_MEDIA_INDEX')).toBe(true);

    const conflict = reconcileExerciseMedia({
      fileNames: ['alias_anatomy-01.webp', 'canonical_anatomy-01.webp'], catalog: catalog(['canonical']), sourceDirectory: 'inbox', aliases: { alias: 'canonical' }
    });
    expect(conflict.items.find((item) => item.parsedSlug === 'alias')?.status).toBe('RENAME_TARGET_CONFLICT');
    expect(conflict.items.find((item) => item.parsedSlug === 'canonical')?.status).toBe('DUPLICATE_MEDIA_INDEX');
  });

  it('marks repeated source filenames as duplicate files', () => {
    const report = reconcileExerciseMedia({
      fileNames: ['exact_anatomy-01.webp', 'exact_anatomy-01.webp'], catalog: catalog(['exact']), sourceDirectory: 'inbox'
    });
    expect(report.items.every((item) => item.status === 'DUPLICATE_FILE_NAME')).toBe(true);
  });

  it('keeps dry runs immutable and safely renames only a verified alias', async () => {
    const directory = await makeTempDirectory();
    const source = join(directory, 'alias_anatomy-02.webp');
    const exact = join(directory, 'exact_anatomy-01.webp');
    await writeFile(source, Buffer.from('unchanged-image-content'));
    await writeFile(exact, Buffer.from('exact-content'));
    const report = reconcileExerciseMedia({
      fileNames: ['alias_anatomy-02.webp', 'exact_anatomy-01.webp'], catalog: catalog(['canonical', 'exact']), sourceDirectory: 'inbox', aliases: { alias: 'canonical' }
    });
    expect(await readFile(source, 'utf8')).toBe('unchanged-image-content');

    const renames = await applyAliasRenames(directory, report);
    expect(renames).toEqual([{ from: 'alias_anatomy-02.webp', to: 'canonical_anatomy-02.webp' }]);
    expect(await readFile(join(directory, 'canonical_anatomy-02.webp'), 'utf8')).toBe('unchanged-image-content');
    expect(await readFile(exact, 'utf8')).toBe('exact-content');

    const rerun = reconcileExerciseMedia({
      fileNames: ['canonical_anatomy-02.webp', 'exact_anatomy-01.webp'], catalog: catalog(['canonical', 'exact']), sourceDirectory: 'inbox', aliases: { alias: 'canonical' }
    });
    expect(rerun.summary).toMatchObject({ exactMatches: 2, aliasMatches: 0, blockingErrors: 0 });
  });

  it('blocks apply for missing, ambiguous, or conflicting coverage', async () => {
    const directory = await makeTempDirectory();
    await writeFile(join(directory, 'unknown_anatomy-01.webp'), 'content');
    const report = reconcileExerciseMedia({ fileNames: ['unknown_anatomy-01.webp'], catalog: catalog(['canonical']), sourceDirectory: 'inbox' });
    await expect(applyAliasRenames(directory, report)).rejects.toThrow('Apply blocked');
    expect(await readFile(join(directory, 'unknown_anatomy-01.webp'), 'utf8')).toBe('content');
  });

  it('writes stable reports without absolute machine paths', async () => {
    const directory = await makeTempDirectory();
    const report = reconcileExerciseMedia({ fileNames: ['exact_anatomy-01.webp'], catalog: catalog(['exact']), sourceDirectory: 'assets/exercise-media/inbox' });
    const jsonPath = join(directory, 'report.json');
    const markdownPath = join(directory, 'report.md');
    await writeReconciliationReports(report, jsonPath, markdownPath);
    const firstJson = await readFile(jsonPath, 'utf8');
    const firstMarkdown = await readFile(markdownPath, 'utf8');
    await writeReconciliationReports(report, jsonPath, markdownPath);
    expect(await readFile(jsonPath, 'utf8')).toBe(firstJson);
    expect(await readFile(markdownPath, 'utf8')).toBe(firstMarkdown);
    expect(firstJson).not.toMatch(/[A-Z]:\\|\/Users\//);
    expect(firstMarkdown).toBe(toReconciliationMarkdown(report));
  });

  async function makeTempDirectory() {
    const directory = await mkdtemp(join(tmpdir(), 'optime-media-reconcile-'));
    temporaryDirectories.push(directory);
    return directory;
  }
});
