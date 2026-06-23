import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { SUPPORTED_LOCALES } from '@optime/shared-types';

import type { SeedExerciseInput } from './types';

interface ApprovedAlignmentReport {
  items: Array<{
    imageSlug: string;
    status: string;
    proposedCanonicalSlug: string | null;
    existingExerciseSlug: string | null;
    proposedAction: string;
    proposedExercise: null | {
      slug: string;
      translations: Record<string, string>;
      category: SeedExerciseInput['category'];
      movementPattern: SeedExerciseInput['movementPattern'];
      equipment: SeedExerciseInput['equipment'];
      levels: SeedExerciseInput['trainingLevels'];
      primaryMuscles: SeedExerciseInput['targetMuscles'];
      secondaryMuscles: SeedExerciseInput['secondaryMuscles'];
    };
  }>;
}

const alignmentReportPath = resolve(__dirname, '../../../../mobile/assets/exercise-media/exercise-media-catalog-alignment.json');
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function loadApprovedExerciseExpansion(existingSlugs: ReadonlySet<string>): SeedExerciseInput[] {
  const report = JSON.parse(readFileSync(alignmentReportPath, 'utf8')) as ApprovedAlignmentReport;
  const seen = new Set<string>();
  const approved = report.items
    .filter((item) => item.status === 'NEW_EXERCISE_CANDIDATE')
    .map((item) => {
      const proposal = item.proposedExercise;
      if (!proposal) throw new Error(`${item.imageSlug}: approved candidate is missing proposedExercise metadata.`);
      if (item.existingExerciseSlug !== null) throw new Error(`${item.imageSlug}: approved new candidate must not target an existing exercise.`);
      if (item.proposedAction !== 'ADD_NEW_EXERCISE') throw new Error(`${item.imageSlug}: approved new candidate must use ADD_NEW_EXERCISE.`);
      if (item.proposedCanonicalSlug !== proposal.slug) throw new Error(`${item.imageSlug}: proposed slug mismatch.`);
      if (!slugPattern.test(proposal.slug)) throw new Error(`${proposal.slug}: approved slug is not lowercase kebab-case.`);
      if (existingSlugs.has(proposal.slug)) throw new Error(`${proposal.slug}: approved slug collides with the existing catalog.`);
      if (seen.has(proposal.slug)) throw new Error(`${proposal.slug}: duplicate approved candidate slug.`);
      seen.add(proposal.slug);

      for (const locale of SUPPORTED_LOCALES) {
        if (!proposal.translations[locale]?.trim()) throw new Error(`${proposal.slug}: missing ${locale} translation.`);
      }
      if (!proposal.primaryMuscles.length) throw new Error(`${proposal.slug}: at least one primary muscle is required.`);

      return {
        slug: proposal.slug,
        names: {
          'en-US': proposal.translations['en-US'],
          'ru-RU': proposal.translations['ru-RU'],
          'fr-FR': proposal.translations['fr-FR'],
          'zh-CN': proposal.translations['zh-CN']
        },
        category: proposal.category,
        movementPattern: proposal.movementPattern,
        equipment: [...proposal.equipment],
        targetMuscles: [...proposal.primaryMuscles],
        secondaryMuscles: [...proposal.secondaryMuscles],
        trainingLevels: [...proposal.levels],
        contraindicationTags: []
      } satisfies SeedExerciseInput;
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

  if (approved.length !== 31) throw new Error(`Approved expansion expected 31 candidates, received ${approved.length}.`);
  return approved;
}
