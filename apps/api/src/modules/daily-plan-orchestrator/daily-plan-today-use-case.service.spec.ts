import { PreferredLocale } from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service';
import type { DailyPlanGenerationUseCaseService } from './daily-plan-generation-use-case.service';
import { DailyPlanTodayUseCaseService } from './daily-plan-today-use-case.service';

describe('DailyPlanTodayUseCaseService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(
      new Date('2026-07-26T22:30:00.000Z')
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('queries Today by the user local calendar date and timezone', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    dependencies.prisma.user.findUnique.mockResolvedValue(
      createUser({ timezone: 'Asia/Yerevan' }) as never
    );
    dependencies.prisma.dailyPlan.findUnique.mockResolvedValue(
      { id: 'plan-1' } as never
    );

    const result = await service.getToday('user-1');

    expect(result).toEqual({ id: 'plan-1' });
    expect(
      dependencies.prisma.dailyPlan.findUnique
    ).toHaveBeenCalledWith({
      where: {
        userId_planLocalDate_planTimezone: {
          userId: 'user-1',
          planLocalDate: '2026-07-27',
          planTimezone: 'Asia/Yerevan'
        }
      }
    });
  });

  it('falls back to UTC for an invalid stored timezone', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    dependencies.prisma.user.findUnique.mockResolvedValue(
      createUser({ timezone: 'Invalid/Timezone' }) as never
    );
    dependencies.prisma.dailyPlan.findUnique.mockResolvedValue(
      null
    );

    await service.getToday('user-1');

    expect(
      dependencies.prisma.dailyPlan.findUnique
    ).toHaveBeenCalledWith({
      where: {
        userId_planLocalDate_planTimezone: {
          userId: 'user-1',
          planLocalDate: '2026-07-26',
          planTimezone: 'UTC'
        }
      }
    });
  });

  it('prepares a consistent generation input from the stored user context', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    const user = createUser({
      timezone: 'Asia/Yerevan',
      preferredLocale: PreferredLocale.RU_RU
    });
    const existingPlan = { id: 'plan-1' };
    dependencies.prisma.user.findUnique.mockResolvedValue(
      user as never
    );
    dependencies.prisma.dailyPlan.findUnique.mockResolvedValue(
      existingPlan as never
    );
    dependencies.generationUseCase.generate.mockResolvedValue(
      { id: 'generated-plan' } as never
    );

    const result = await service.generateToday({
      userId: 'user-1',
      forceRegenerate: true,
      recreateForCurrentLanguage: false
    });

    expect(result).toEqual({ id: 'generated-plan' });
    expect(
      dependencies.generationUseCase.generate
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      user,
      existingPlan,
      planLocalDate: '2026-07-27',
      planTimezone: 'Asia/Yerevan',
      locale: 'ru-RU',
      forceRegenerate: true,
      recreateForCurrentLanguage: false
    });
  });

  it('rejects a stale session before querying or generating a plan', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    dependencies.prisma.user.findUnique.mockResolvedValue(
      null
    );

    await expect(
      service.getToday('missing-user')
    ).rejects.toThrow(
      'Your session is no longer valid. Please log in again.'
    );
    expect(
      dependencies.prisma.dailyPlan.findUnique
    ).not.toHaveBeenCalled();
    expect(
      dependencies.generationUseCase.generate
    ).not.toHaveBeenCalled();
  });
});

function createService(
  dependencies: ReturnType<typeof createDependencies>
) {
  return new DailyPlanTodayUseCaseService(
    dependencies.prisma as unknown as PrismaService,
    dependencies.generationUseCase
  );
}

function createDependencies() {
  return {
    prisma: {
      user: {
        findUnique: jest.fn()
      },
      dailyPlan: {
        findUnique: jest.fn()
      }
    },
    generationUseCase: {
      generate: jest.fn()
    } as unknown as jest.Mocked<DailyPlanGenerationUseCaseService>
  };
}

function createUser(input: {
  timezone: string;
  preferredLocale?: PreferredLocale;
}) {
  return {
    id: 'user-1',
    timezone: input.timezone,
    locale: 'en-US',
    settings: input.preferredLocale
      ? { preferredLocale: input.preferredLocale }
      : null
  };
}
