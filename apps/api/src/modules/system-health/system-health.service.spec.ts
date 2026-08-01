import { ServiceUnavailableException } from '@nestjs/common';

import type { PrismaService } from '../../prisma/prisma.service';
import { SystemHealthService } from './system-health.service';

describe('SystemHealthService', () => {
  it('reports process liveness without checking dependencies', () => {
    const { service, queryRaw } = createService();

    expect(service.getLiveness()).toEqual({ status: 'ok' });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('reports readiness when PostgreSQL responds', async () => {
    const { service, queryRaw } = createService();
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.getReadiness()).resolves.toEqual({
      status: 'ready',
      checks: { database: 'up' }
    });
  });

  it('returns a safe unavailable response when PostgreSQL fails', async () => {
    const { service, queryRaw } = createService();
    queryRaw.mockRejectedValue(new Error('sensitive database failure detail'));

    const readiness = service.getReadiness();

    await expect(readiness).rejects.toMatchObject({
      response: {
        status: 'not_ready',
        checks: { database: 'down' }
      }
    });
    await expect(readiness).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

function createService() {
  const queryRaw = jest.fn();
  const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;

  return {
    service: new SystemHealthService(prisma),
    queryRaw
  };
}
