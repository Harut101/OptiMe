import request from 'supertest';
import {
  ExerciseCategory,
  ExerciseEquipment,
  ExerciseMediaType,
  MovementPattern,
  PreferredLocale,
  TargetMuscleGroup,
  TrainingLevel
} from '@prisma/client';

import { exerciseCatalog } from '../prisma/seeds/exercises';
import { seedExerciseCatalog } from '../prisma/seeds/exercises/seed';
import { validateExerciseCatalog } from '../prisma/seeds/exercises/validate-catalog';
import { authHeader, registerTestUser } from './helpers/auth';
import { createTestApp, TestApp } from './helpers/test-app';

describe('ExerciseLibrary', () => {
  let ctx: TestApp;
  let accessToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedExerciseCatalog(ctx.prisma);
    accessToken = (await registerTestUser(ctx.app)).accessToken;
  });

  afterEach(async () => {
    await ctx.prisma.exercise.deleteMany({ where: { slug: { startsWith: 'qa-' } } });
  });

  afterAll(async () => {
    await ctx.prisma.user.deleteMany({ where: { email: { startsWith: 'test-' } } });
    await ctx.app.close();
  });

  it('requires authentication for list and detail routes', async () => {
    await request(ctx.app.getHttpServer()).get('/v1/exercises').expect(401);
    await request(ctx.app.getHttpServer()).get('/v1/exercises/bodyweight-squat').expect(401);
  });

  it('validates and seeds the 46-item catalog idempotently with four translations each', async () => {
    const validation = validateExerciseCatalog(exerciseCatalog);
    expect(validation).toEqual({ exerciseCount: 46, translationCount: 184, mediaCount: 0 });

    await seedExerciseCatalog(ctx.prisma);
    await seedExerciseCatalog(ctx.prisma);

    const seeded = await ctx.prisma.exercise.findMany({
      where: { slug: { in: exerciseCatalog.map((item) => item.slug) } },
      include: { translations: true }
    });
    expect(seeded).toHaveLength(46);
    expect(seeded.every((item) => item.translations.length === 4)).toBe(true);
  });

  it('lists active exercises with bounded pagination and deterministic ordering', async () => {
    await createQaExercise('qa-inactive', { isActive: false, sortOrder: 0 });

    const first = await apiList('?page=1&pageSize=5');
    const second = await apiList('?page=1&pageSize=5');

    expect(first.body.items).toHaveLength(5);
    expect(first.body.items).toEqual(second.body.items);
    expect(first.body.pagination).toMatchObject({ page: 1, pageSize: 5, totalItems: 46, totalPages: 10 });
    expect(first.body.items.map((item: { slug: string }) => item.slug)).not.toContain('qa-inactive');
    expect(first.body.items.every((item: { thumbnail: unknown }) => item.thumbnail === null)).toBe(true);

    await apiList('?pageSize=51', 400);
    await apiList('?page=0', 400);
  });

  it('supports category, equipment, muscle, level, pattern, and combined filters', async () => {
    const response = await apiList('?category=STRENGTH&equipment=MACHINES&targetMuscle=QUADRICEPS&trainingLevel=BEGINNER&movementPattern=SQUAT');
    expect(response.body.items.map((item: { slug: string }) => item.slug)).toContain('leg-press');
    expect(response.body.items.every((item: { category: string }) => item.category === 'STRENGTH')).toBe(true);

    await apiList('?category=translated-value', 400);
    await apiList('?targetMuscle=UPPER_BACK', 400);
  });

  it('searches localized names and resolves all supported locales without mutating persistence', async () => {
    const before = await ctx.prisma.exerciseTranslation.findMany({
      where: { exercise: { slug: 'leg-press' } },
      orderBy: { locale: 'asc' }
    });
    const expected: Record<string, PreferredLocale> = {
      'en-US': PreferredLocale.EN_US,
      'ru-RU': PreferredLocale.RU_RU,
      'fr-FR': PreferredLocale.FR_FR,
      'zh-CN': PreferredLocale.ZH_CN
    };

    for (const [locale, prismaLocale] of Object.entries(expected)) {
      const translation = before.find((item) => item.locale === prismaLocale)!;
      const detail = await apiDetail('leg-press', locale);
      expect(detail.body.name).toBe(translation.name);
      expect(detail.body.resolvedLocale).toBe(locale);
      const search = await apiList(`?search=${encodeURIComponent(translation.name)}`, 200, locale);
      expect(search.body.items.map((item: { slug: string }) => item.slug)).toContain('leg-press');
    }

    const unsupported = await apiDetail('leg-press', 'es-ES');
    expect(unsupported.body.resolvedLocale).toBe('en-US');
    expect(unsupported.body.name).toBe(before.find((item) => item.locale === PreferredLocale.EN_US)!.name);
    expect(await ctx.prisma.exerciseTranslation.findMany({ where: { exercise: { slug: 'leg-press' } }, orderBy: { locale: 'asc' } })).toEqual(before);
  });

  it('looks up active details by slug and ID and returns no-media records safely', async () => {
    const bySlug = await apiDetail('bodyweight-squat', 'en-US');
    const byId = await apiDetail(bySlug.body.id, 'en-US');
    expect(byId.body).toEqual(bySlug.body);
    expect(bySlug.body.media).toEqual([]);
    expect(bySlug.body.instructions.length).toBeGreaterThan(0);

    await apiDetail('missing-exercise', 'en-US', 404);
    const inactive = await createQaExercise('qa-hidden-detail', { isActive: false });
    await apiDetail(inactive.id, 'en-US', 404);
  });

  it('falls back exercise and media translations to English', async () => {
    const exercise = await createQaExercise('qa-fallback', { onlyEnglish: true, withMedia: true });
    const detail = await apiDetail(exercise.id, 'ru-RU');
    expect(detail.body.name).toBe('QA Fallback');
    expect(detail.body.resolvedLocale).toBe('en-US');
    expect(detail.body.media[0].altText).toBe('QA exercise demonstration');
  });

  it('returns active media in deterministic order and resolves the primary thumbnail', async () => {
    const exercise = await createQaExercise('qa-media', { withMedia: true, multipleMedia: true });
    const list = await apiList('?search=QA%20Media');
    const item = list.body.items.find((candidate: { id: string }) => candidate.id === exercise.id);
    expect(item.thumbnail).toEqual({ url: 'https://cdn.optime.test/qa-media-thumb.webp', altText: 'QA exercise demonstration' });

    const detail = await apiDetail(exercise.slug, 'en-US');
    expect(detail.body.media.map((media: { sortOrder: number }) => media.sortOrder)).toEqual([1, 2]);
    expect(detail.body.media.map((media: { url: string }) => media.url)).not.toContain('https://cdn.optime.test/inactive.webp');
    expect(detail.body.media[0]).not.toHaveProperty('license');
    expect(detail.body.media[0]).not.toHaveProperty('attribution');
  });

  it('enforces slug, translation, media-translation, and active-primary uniqueness', async () => {
    const exercise = await createQaExercise('qa-constraints', { withMedia: true });
    await expect(createQaExercise('qa-constraints')).rejects.toBeDefined();
    await expect(ctx.prisma.exerciseTranslation.create({
      data: { exerciseId: exercise.id, locale: PreferredLocale.EN_US, name: 'Duplicate', instructions: ['One'], coachingCues: ['One'], safetyNotes: ['One'] }
    })).rejects.toBeDefined();

    const media = await ctx.prisma.exerciseMedia.findFirstOrThrow({ where: { exerciseId: exercise.id } });
    await expect(ctx.prisma.exerciseMediaTranslation.create({
      data: { exerciseMediaId: media.id, locale: PreferredLocale.EN_US, altText: 'Duplicate' }
    })).rejects.toBeDefined();
    await expect(ctx.prisma.exerciseMedia.create({
      data: { exerciseId: exercise.id, type: ExerciseMediaType.PRIMARY, url: 'https://cdn.optime.test/second-primary.webp', isPrimary: true }
    })).rejects.toBeDefined();
  });

  it('uses safe defaults and cascades translations and media when an exercise is deleted', async () => {
    const exercise = await createQaExercise('qa-cascade', { withMedia: true });
    expect(exercise.isActive).toBe(true);
    expect(exercise.sortOrder).toBe(0);
    const media = await ctx.prisma.exerciseMedia.findFirstOrThrow({ where: { exerciseId: exercise.id } });

    await ctx.prisma.exercise.delete({ where: { id: exercise.id } });
    expect(await ctx.prisma.exerciseTranslation.count({ where: { exerciseId: exercise.id } })).toBe(0);
    expect(await ctx.prisma.exerciseMedia.count({ where: { exerciseId: exercise.id } })).toBe(0);
    expect(await ctx.prisma.exerciseMediaTranslation.count({ where: { exerciseMediaId: media.id } })).toBe(0);
  });

  function apiList(query = '', status = 200, locale = 'en-US') {
    return request(ctx.app.getHttpServer())
      .get(`/v1/exercises${query}`)
      .set(authHeader(accessToken))
      .set('Accept-Language', locale)
      .expect(status);
  }

  function apiDetail(idOrSlug: string, locale = 'en-US', status = 200) {
    return request(ctx.app.getHttpServer())
      .get(`/v1/exercises/${idOrSlug}`)
      .set(authHeader(accessToken))
      .set('Accept-Language', locale)
      .expect(status);
  }

  async function createQaExercise(slug: string, options: {
    isActive?: boolean;
    sortOrder?: number;
    onlyEnglish?: boolean;
    withMedia?: boolean;
    multipleMedia?: boolean;
  } = {}) {
    const displayName = slug.split('-').slice(1).map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
    return ctx.prisma.exercise.create({
      data: {
        slug,
        category: ExerciseCategory.STRENGTH,
        movementPattern: MovementPattern.SQUAT,
        equipment: [ExerciseEquipment.BODYWEIGHT],
        targetMuscles: [TargetMuscleGroup.QUADRICEPS],
        trainingLevels: [TrainingLevel.BEGINNER],
        isActive: options.isActive,
        sortOrder: options.sortOrder,
        translations: {
          create: [
            { locale: PreferredLocale.EN_US, name: `QA ${displayName}`, description: 'QA exercise description', instructions: ['Move with control.'], coachingCues: ['Breathe steadily.'], safetyNotes: ['Stop if the movement causes pain.'] },
            ...(!options.onlyEnglish ? [{ locale: PreferredLocale.RU_RU, name: `QA RU ${displayName}`, instructions: ['Move with control.'], coachingCues: ['Breathe steadily.'], safetyNotes: ['Stop if the movement causes pain.'] }] : [])
          ]
        },
        media: options.withMedia ? {
          create: [
            {
              seedKey: `${slug}-primary`, type: ExerciseMediaType.PRIMARY,
              url: `https://cdn.optime.test/${slug}.webp`, thumbnailUrl: `https://cdn.optime.test/${slug}-thumb.webp`,
              sortOrder: 1, isPrimary: true, source: 'QA', license: 'test-only', attribution: 'OptiMe QA',
              translations: { create: { locale: PreferredLocale.EN_US, altText: 'QA exercise demonstration' } }
            },
            ...(options.multipleMedia ? [
              { seedKey: `${slug}-technique`, type: ExerciseMediaType.TECHNIQUE, url: 'https://cdn.optime.test/technique.webp', sortOrder: 2, translations: { create: { locale: PreferredLocale.EN_US, altText: 'QA technique view' } } },
              { seedKey: `${slug}-inactive`, type: ExerciseMediaType.ALTERNATE, url: 'https://cdn.optime.test/inactive.webp', sortOrder: 0, isActive: false, translations: { create: { locale: PreferredLocale.EN_US, altText: 'Inactive view' } } }
            ] : [])
          ]
        } : undefined
      }
    });
  }
});
