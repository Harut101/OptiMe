import { NutritionAgentService } from './nutrition-agent.service';

describe('NutritionAgentService OpenAI request contract', () => {
  it('requires exact recipe-template ingredient roles and ordering', () => {
    const service = Object.create(NutritionAgentService.prototype) as {
      buildSystemInstructions: () => string;
    };

    const instructions = service.buildSystemInstructions();

    expect(instructions).toContain(
      'exactly the same number of ingredients as the selected recipe template ingredientRoles array'
    );
    expect(instructions).toContain(
      'exact ingredientRoles order from the selected recipe template'
    );
    expect(instructions).toContain(
      'selectionRoles contains the required recipe-template role'
    );
  });

  it('passes safe failure reasons to a correction request and marks it as a retry', async () => {
    const telemetryExecute = jest.fn().mockResolvedValue({ output_text: '{}' });
    const service = Object.create(NutritionAgentService.prototype) as Record<string, unknown>;

    Object.assign(service, {
      logger: { log: jest.fn(), warn: jest.fn() },
      configService: { get: jest.fn() },
      modelRouter: {
        resolve: jest.fn().mockReturnValue({
          agent: 'NUTRITION',
          route: 'LUNA',
          model: 'test-model',
          inputCostPer1MUsd: 1,
          outputCostPer1MUsd: 1
        })
      },
      catalogFeasibility: {
        assess: jest.fn().mockReturnValue({
          status: 'FEASIBLE',
          safeCandidateCount: 1,
          reasonCodes: []
        })
      },
      recipeTemplates: {
        listAvailableForSelection: jest.fn().mockReturnValue([
          {
            id: 'breakfast-template',
            mealType: 'BREAKFAST',
            ingredients: [{ role: 'BREAKFAST_BASE', grams: 50 }]
          }
        ])
      },
      requestTelemetry: { execute: telemetryExecute },
      selectCatalogForComposition: jest.fn().mockResolvedValue({
        candidates: [{ slug: 'oats' }],
        byRole: {}
      }),
      buildPlanningContext: jest.fn().mockReturnValue({}),
      getRequestOperation: jest.fn().mockReturnValue('NUTRITION_GENERATION'),
      getRequestTimeoutMs: jest.fn().mockReturnValue(45_000),
      getClient: jest.fn().mockReturnValue({ responses: { create: jest.fn() } }),
      parseAndValidateResponse: jest.fn().mockReturnValue({
        ok: false,
        validationReasons: ['SCHEMA_INVALID'],
        errorReason: 'SCHEMA_INVALID'
      })
    });

    await (service.requestOpenAiFoodPlan as (
      input: Record<string, unknown>,
      feedback: Record<string, unknown>
    ) => Promise<unknown>)(
      {
        userId: 'safe-test-user',
        planQualityMode: 'BASIC',
        nutritionTarget: {
          calories: { targetKcal: 2_000 },
          macros: { proteinGrams: 120, carbsGrams: 240, fatGrams: 60 }
        }
      },
      { reasonCodes: ['SCHEMA_INVALID'] }
    );

    expect(telemetryExecute).toHaveBeenCalledWith(
      expect.objectContaining({ retryAttempt: true })
    );
    const request = telemetryExecute.mock.calls[0][0] as {
      request: () => Promise<unknown>;
    };
    await request.request();
    const create = (service.getClient as () => {
      responses: { create: jest.Mock };
    })().responses.create;
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining(
              'Previous attempt reason codes: SCHEMA_INVALID.'
            )
          })
        ])
      }),
      { timeout: 45_000 }
    );
  });
});
