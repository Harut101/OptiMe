import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SystemHealthService {
  constructor(private readonly prisma: PrismaService) {}

  getLiveness() {
    return { status: 'ok' as const };
  }

  async getReadiness() {
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);

      return {
        status: 'ready' as const,
        checks: { database: 'up' as const }
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        checks: { database: 'down' }
      });
    }
  }
}
