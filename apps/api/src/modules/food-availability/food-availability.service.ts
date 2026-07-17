import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { DietType } from '@prisma/client';
import { resolveSupportedLocale, type SupportedLocale } from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import { FoodCatalogService } from '../food-catalog/food-catalog.service';
import { ReplaceFoodAvailabilityDto } from './dto/replace-food-availability.dto';

type FoodAvailabilityContext = {
  userId: string;
  timezone: string;
  locale: SupportedLocale;
  dietType: DietType | null;
  allergies: string[];
  excludedFoods: string[];
  dislikedFoods: string[];
};

@Injectable()
export class FoodAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly foodCatalog: FoodCatalogService
  ) {}

  async getToday(userId: string) {
    const context = await this.getContext(userId);
    const localDate = this.localDate(context.timezone);
    return this.getForLocalDate(context, localDate);
  }

  async listTodayCandidates(userId: string) {
    const context = await this.getContext(userId);
    const candidates = await this.allowedCandidates(context);

    return {
      items: candidates.map((item) => ({
        slug: item.slug,
        name: item.name,
        category: item.category,
        preparationLevel: item.preparationLevel
      }))
    };
  }

  async replaceToday(userId: string, dto: ReplaceFoodAvailabilityDto) {
    const context = await this.getContext(userId);
    const localDate = this.localDate(context.timezone);
    const allowedCandidates = await this.allowedCandidates(context);
    const allowedBySlug = new Map(allowedCandidates.map((candidate) => [candidate.slug, candidate]));
    const requestedSlugs = [...new Set(dto.catalogFoodSlugs.map((slug) => slug.trim()).filter(Boolean))];
    const unavailableSlugs = requestedSlugs.filter((slug) => !allowedBySlug.has(slug));

    if (unavailableSlugs.length) {
      throw new BadRequestException('Selected food is unavailable for your current food preferences.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userAvailableFood.deleteMany({ where: { userId, localDate } });
      if (requestedSlugs.length) {
        await tx.userAvailableFood.createMany({
          data: requestedSlugs.map((slug) => ({
            userId,
            localDate,
            foodCatalogItemId: allowedBySlug.get(slug)!.id
          }))
        });
      }
    });

    return this.getForLocalDate(context, localDate);
  }

  async getAvailableFoodSlugs(userId: string, localDate: string) {
    const rows = await this.prisma.userAvailableFood.findMany({
      where: { userId, localDate },
      select: { foodCatalogItem: { select: { slug: true, isActive: true } } }
    });

    return rows
      .filter((row) => row.foodCatalogItem.isActive)
      .map((row) => row.foodCatalogItem.slug);
  }

  private async getForLocalDate(context: FoodAvailabilityContext, localDate: string) {
    const [rows, candidates] = await Promise.all([
      this.prisma.userAvailableFood.findMany({
        where: { userId: context.userId, localDate },
        select: { foodCatalogItem: { select: { slug: true } } },
        orderBy: { createdAt: 'asc' }
      }),
      this.allowedCandidates(context)
    ]);
    const candidatesBySlug = new Map(candidates.map((candidate) => [candidate.slug, candidate]));

    return {
      localDate,
      items: rows
        .map((row) => candidatesBySlug.get(row.foodCatalogItem.slug))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .map((item) => ({
          slug: item.slug,
          name: item.name,
          category: item.category,
          preparationLevel: item.preparationLevel
        }))
    };
  }

  private async allowedCandidates(context: FoodAvailabilityContext) {
    return this.foodCatalog.listAllowedCandidates({
      locale: context.locale,
      dietType: context.dietType,
      limit: 160,
      restrictions: {
        allergies: context.allergies,
        excludedFoods: context.excludedFoods,
        dislikedFoods: context.dislikedFoods
      }
    });
  }

  private async getContext(userId: string): Promise<FoodAvailabilityContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        timezone: true,
        locale: true,
        nutritionPref: {
          select: {
            dietType: true,
            allergies: { select: { name: true } },
            excludedFoods: { select: { name: true } },
            dislikedFoods: { select: { name: true } }
          }
        }
      }
    });
    if (!user) throw new NotFoundException('User not found.');

    return {
      userId: user.id,
      timezone: user.timezone,
      locale: resolveSupportedLocale(user.locale),
      dietType: user.nutritionPref?.dietType ?? null,
      allergies: user.nutritionPref?.allergies.map((item) => item.name) ?? [],
      excludedFoods: user.nutritionPref?.excludedFoods.map((item) => item.name) ?? [],
      dislikedFoods: user.nutritionPref?.dislikedFoods.map((item) => item.name) ?? []
    };
  }

  private localDate(timezone: string) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(new Date());
      const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
      return `${value('year')}-${value('month')}-${value('day')}`;
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }
}
