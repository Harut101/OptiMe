import type { PrismaService } from '../../prisma/prisma.service';
import { FoodRotationContextService } from './food-rotation-context.service';

describe('FoodRotationContextService', () => {
  it('summarizes distinct recent plan days without exposing plan content', async () => {
    const prisma = {
      dailyPlan: {
        findMany: jest.fn().mockResolvedValue([
          createStoredPlan('2026-07-27', [
            'potato-cooked',
            'potato-cooked'
          ]),
          createStoredPlan('2026-07-25', [
            'potato-cooked',
            'rice-cooked'
          ])
        ])
      }
    };
    const service = new FoodRotationContextService(
      prisma as unknown as PrismaService
    );

    const result = await service.getContext(
      'user-1',
      '2026-07-28'
    );

    expect(prisma.dailyPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          planLocalDate: {
            gte: '2026-07-14',
            lt: '2026-07-28'
          }
        })
      })
    );
    expect(result).toEqual({
      lookbackDays: 14,
      usage: [
        {
          catalogFoodSlug: 'potato-cooked',
          occurrenceCount: 3,
          daysUsed: 2,
          lastUsedLocalDate: '2026-07-27',
          daysSinceLastUse: 1
        },
        {
          catalogFoodSlug: 'rice-cooked',
          occurrenceCount: 1,
          daysUsed: 1,
          lastUsedLocalDate: '2026-07-25',
          daysSinceLastUse: 3
        }
      ]
    });
  });
});

function createStoredPlan(
  planLocalDate: string,
  ingredientSlugs: string[]
) {
  const ingredients = ingredientSlugs.map(
    (catalogFoodSlug, index) => ({
      catalogFoodSlug,
      name: catalogFoodSlug,
      quantity: 100,
      unit: 'g',
      isOptional: false,
      caloriesKcal: 100,
      proteinGrams: 10,
      carbsGrams: 10,
      fatGrams: 2,
      role: index === 0 ? 'MAIN' : 'SIDE',
      measurementState: 'COOKED',
      preparation: 'Measure after cooking.',
      usage: 'Use in this meal.'
    })
  );
  const multiplier = ingredients.length;

  return {
    planLocalDate,
    planJson: {
      nutrition: {
        foodPlan: {
          source: 'NUTRITION_AGENT',
          localDate: planLocalDate,
          locale: 'en-US',
          nutritionTargetSnapshot: {
            engineVersion: 1,
            localDate: planLocalDate,
            dayType: 'REST_DAY',
            appMode: 'NUTRITION_ONLY',
            primaryGoal: 'HEALTHY_EATING',
            targetKcal: 2000,
            minKcal: 1800,
            maxKcal: 2200,
            maintenanceEstimateKcal: 2000,
            proteinGrams: 120,
            carbsGrams: 230,
            fatGrams: 67,
            safetyStatus: 'OK',
            safetyReasons: [],
            explanation: {
              titleCode: 'TODAY_TARGET',
              reasonCodes: []
            }
          },
          totals: {
            caloriesKcal: 100 * multiplier,
            proteinGrams: 10 * multiplier,
            carbsGrams: 10 * multiplier,
            fatGrams: 2 * multiplier
          },
          validation: {
            status: 'VALID',
            reasons: [],
            tolerances: {
              caloriesPercent: 5,
              proteinGrams: 10,
              carbsGrams: 15,
              fatGrams: 8
            }
          },
          meals: [
            {
              id: `meal-${planLocalDate}`,
              mealType: 'DINNER',
              title: 'Dinner',
              shortDescription: null,
              prepTimeMinutes: 10,
              servingSummary: '1 serving',
              caloriesKcal: 100 * multiplier,
              proteinGrams: 10 * multiplier,
              carbsGrams: 10 * multiplier,
              fatGrams: 2 * multiplier,
              ingredients,
              preparationSteps: ['Prepare and serve.'],
              substitutions: [],
              explanation: {
                reasonCodes: ['TARGET_ALIGNED']
              }
            }
          ]
        }
      }
    }
  };
}
