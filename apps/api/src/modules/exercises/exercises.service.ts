import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PreferredLocale } from '@prisma/client';
import type {
  ExerciseDetail,
  ExerciseListItem,
  ExerciseListResponse,
  SupportedLocale
} from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import { ListExercisesQueryDto } from './dto/list-exercises-query.dto';
import { ENGLISH_PRISMA_LOCALE, toPrismaLocale } from './exercise-locale';

const exerciseInclude = {
  translations: true,
  media: {
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
    include: { translations: true }
  }
} satisfies Prisma.ExerciseInclude;

type ExerciseRecord = Prisma.ExerciseGetPayload<{ include: typeof exerciseInclude }>;

@Injectable()
export class ExercisesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async getActiveForSelection(locale: SupportedLocale) {
    const records = await this.prisma.exercise.findMany({
      where: { isActive: true },
      include: { translations: true },
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }]
    });

    return records.map((record) => {
      const translation = this.translationFor(record.translations, locale);
      return {
        exerciseId: record.id,
        slug: record.slug,
        name: translation.value.name,
        resolvedLocale: translation.locale,
        category: record.category,
        movementPattern: record.movementPattern,
        equipment: record.equipment,
        targetMuscles: record.targetMuscles,
        secondaryMuscles: record.secondaryMuscles,
        trainingLevels: record.trainingLevels,
        instructions: translation.value.instructions,
        coachingCues: translation.value.coachingCues,
        safetyNotes: translation.value.safetyNotes,
        contraindicationTags: record.contraindicationTags,
        exerciseUpdatedAt: record.updatedAt.toISOString(),
        sortOrder: record.sortOrder
      };
    });
  }

  async list(query: ListExercisesQueryDto, locale: SupportedLocale): Promise<ExerciseListResponse> {
    const where = this.buildWhere(query, locale);
    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.exercise.findMany({
        where,
        include: exerciseInclude,
        orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      this.prisma.exercise.count({ where })
    ]);

    return {
      items: records.map((record) => this.toListItem(record, locale)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize)
      }
    };
  }

  async getByIdOrSlug(idOrSlug: string, locale: SupportedLocale): Promise<ExerciseDetail> {
    const record = await this.prisma.exercise.findFirst({
      where: { isActive: true, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: exerciseInclude
    });
    if (!record) throw new NotFoundException('Exercise not found.');
    return this.toDetail(record, locale);
  }

  private buildWhere(query: ListExercisesQueryDto, locale: SupportedLocale): Prisma.ExerciseWhereInput {
    const search = query.search?.trim();
    const localeValues = [...new Set([toPrismaLocale(locale), ENGLISH_PRISMA_LOCALE])];
    return {
      isActive: true,
      id: query.ids ? { in: [...new Set(query.ids)] } : undefined,
      category: query.category,
      movementPattern: query.movementPattern,
      equipment: query.equipment ? { has: query.equipment } : undefined,
      targetMuscles: query.targetMuscle ? { has: query.targetMuscle } : undefined,
      trainingLevels: query.trainingLevel ? { has: query.trainingLevel } : undefined,
      translations: search
        ? { some: { locale: { in: localeValues }, OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ] } }
        : undefined
    };
  }

  private toListItem(record: ExerciseRecord, locale: SupportedLocale): ExerciseListItem {
    const translation = this.translationFor(record.translations, locale);
    const primary = record.media.find((item) => item.isPrimary);
    const mediaTranslation = primary ? this.translationFor(primary.translations, locale) : null;
    return {
      id: record.id,
      slug: record.slug,
      name: translation.value.name,
      category: record.category,
      targetMuscles: record.targetMuscles,
      equipment: record.equipment,
      thumbnail: primary ? { url: this.resolveMediaUrl(primary.thumbnailUrl ?? primary.url), altText: mediaTranslation?.value.altText ?? translation.value.name } : null,
      resolvedLocale: translation.locale
    };
  }

  private toDetail(record: ExerciseRecord, locale: SupportedLocale): ExerciseDetail {
    const translation = this.translationFor(record.translations, locale);
    return {
      id: record.id,
      slug: record.slug,
      name: translation.value.name,
      description: translation.value.description,
      category: record.category,
      movementPattern: record.movementPattern,
      equipment: record.equipment,
      targetMuscles: record.targetMuscles,
      secondaryMuscles: record.secondaryMuscles,
      trainingLevels: record.trainingLevels,
      instructions: translation.value.instructions,
      coachingCues: translation.value.coachingCues,
      safetyNotes: translation.value.safetyNotes,
      contraindicationTags: record.contraindicationTags,
      media: record.media.map((item) => {
        const localized = this.translationFor(item.translations, locale);
        return {
          id: item.id,
          type: item.type,
          url: this.resolveMediaUrl(item.url),
          thumbnailUrl: item.thumbnailUrl ? this.resolveMediaUrl(item.thumbnailUrl) : null,
          width: item.width,
          height: item.height,
          sortOrder: item.sortOrder,
          isPrimary: item.isPrimary,
          altText: localized.value.altText,
          caption: localized.value.caption
        };
      }),
      resolvedLocale: translation.locale
    };
  }

  private translationFor<T extends { locale: PreferredLocale }>(translations: T[], locale: SupportedLocale) {
    const requested = toPrismaLocale(locale);
    const value = translations.find((item) => item.locale === requested)
      ?? translations.find((item) => item.locale === ENGLISH_PRISMA_LOCALE);
    if (!value) throw new NotFoundException('Exercise English translation is unavailable.');
    return { value, locale: value.locale === requested ? locale : 'en-US' as const };
  }

  private resolveMediaUrl(value: string) {
    if (/^https?:\/\//i.test(value)) return value;
    const path = value.startsWith('/') ? value : `/${value}`;
    const base = this.config.get<string>('EXERCISE_MEDIA_PUBLIC_BASE_URL')?.trim();
    if (!base) return path;
    return `${base.replace(/\/+$/, '')}${path}`;
  }
}
