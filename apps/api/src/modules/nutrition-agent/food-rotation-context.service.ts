import { Injectable, Logger } from '@nestjs/common';
import { PlanStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { dailyFoodPlanSchema } from '../daily-plans/daily-plan-json.schema';
import type {
  FoodRotationContext,
  FoodRotationUsage
} from './nutrition-agent.types';

const DEFAULT_LOOKBACK_DAYS = 14;

@Injectable()
export class FoodRotationContextService {
  private readonly logger = new Logger(
    FoodRotationContextService.name
  );

  constructor(private readonly prisma: PrismaService) {}

  async getContext(
    userId: string,
    planLocalDate: string,
    lookbackDays = DEFAULT_LOOKBACK_DAYS
  ): Promise<FoodRotationContext> {
    const normalizedLookback = Math.min(
      Math.max(Math.trunc(lookbackDays), 1),
      30
    );
    const plans = await this.prisma.dailyPlan.findMany({
      where: {
        userId,
        planLocalDate: {
          gte: shiftLocalDate(planLocalDate, -normalizedLookback),
          lt: planLocalDate
        },
        status: {
          in: [PlanStatus.READY, PlanStatus.FALLBACK]
        }
      },
      orderBy: {
        planLocalDate: 'desc'
      },
      select: {
        planLocalDate: true,
        planJson: true
      }
    });
    const usageBySlug = new Map<
      string,
      {
        occurrenceCount: number;
        dates: Set<string>;
        lastUsedLocalDate: string;
      }
    >();

    for (const plan of plans) {
      const foodPlan = extractFoodPlan(plan.planJson);
      if (!foodPlan) continue;

      for (const ingredient of foodPlan.meals.flatMap(
        (meal) => meal.ingredients
      )) {
        const slug = ingredient.catalogFoodSlug?.trim();
        if (!slug) continue;
        const current = usageBySlug.get(slug) ?? {
          occurrenceCount: 0,
          dates: new Set<string>(),
          lastUsedLocalDate: plan.planLocalDate
        };
        current.occurrenceCount += 1;
        current.dates.add(plan.planLocalDate);
        if (plan.planLocalDate > current.lastUsedLocalDate) {
          current.lastUsedLocalDate = plan.planLocalDate;
        }
        usageBySlug.set(slug, current);
      }
    }

    const usage: FoodRotationUsage[] = [...usageBySlug.entries()]
      .map(([catalogFoodSlug, item]) => ({
        catalogFoodSlug,
        occurrenceCount: item.occurrenceCount,
        daysUsed: item.dates.size,
        lastUsedLocalDate: item.lastUsedLocalDate,
        daysSinceLastUse: localDateDifference(
          planLocalDate,
          item.lastUsedLocalDate
        )
      }))
      .sort(
        (left, right) =>
          right.daysUsed - left.daysUsed ||
          left.daysSinceLastUse - right.daysSinceLastUse ||
          left.catalogFoodSlug.localeCompare(right.catalogFoodSlug)
      );

    this.logger.log(
      [
        'food rotation context resolved',
        `lookbackDays=${normalizedLookback}`,
        `sourcePlanCount=${plans.length}`,
        `recentFoodCount=${usage.length}`
      ].join('; ')
    );

    return {
      lookbackDays: normalizedLookback,
      usage
    };
  }
}

function extractFoodPlan(planJson: unknown) {
  if (!isRecord(planJson)) return null;
  const nutrition = planJson.nutrition;
  if (!isRecord(nutrition)) return null;
  const parsed = dailyFoodPlanSchema.safeParse(
    nutrition.foodPlan
  );
  return parsed.success ? parsed.data : null;
}

function shiftLocalDate(localDate: string, days: number) {
  const date = parseLocalDate(localDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function localDateDifference(later: string, earlier: string) {
  return Math.max(
    0,
    Math.round(
      (parseLocalDate(later).getTime() -
        parseLocalDate(earlier).getTime()) /
        86_400_000
    )
  );
}

function parseLocalDate(localDate: string) {
  const parsed = new Date(`${localDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Food rotation requires a valid local date.');
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value)
  );
}
