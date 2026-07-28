import { Inject, Injectable, Logger } from '@nestjs/common';
import type { z } from 'zod';

import { WHOOP_CONFIG, WHOOP_HTTP_CLIENT } from './whoop.constants';
import {
  whoopCycleCollectionSchema,
  whoopRecoveryCollectionSchema,
  whoopSleepCollectionSchema,
  whoopWorkoutCollectionSchema
} from './whoop-data.schemas';
import { WhoopError } from './whoop.error';
import type { WhoopCollectionQuery, WhoopConfig, WhoopHttpClient } from './whoop.types';

@Injectable()
export class WhoopApiClientService {
  private readonly logger = new Logger(WhoopApiClientService.name);

  constructor(
    @Inject(WHOOP_CONFIG) private readonly config: WhoopConfig,
    @Inject(WHOOP_HTTP_CLIENT) private readonly httpClient: WhoopHttpClient
  ) {}

  getCycles(accessToken: string, query: WhoopCollectionQuery) {
    return this.getCollection('/v2/cycle', accessToken, query, whoopCycleCollectionSchema, 'cycles');
  }

  getRecovery(accessToken: string, query: WhoopCollectionQuery) {
    return this.getCollection(
      '/v2/recovery',
      accessToken,
      query,
      whoopRecoveryCollectionSchema,
      'recovery'
    );
  }

  getSleep(accessToken: string, query: WhoopCollectionQuery) {
    return this.getCollection(
      '/v2/activity/sleep',
      accessToken,
      query,
      whoopSleepCollectionSchema,
      'sleep'
    );
  }

  getWorkouts(accessToken: string, query: WhoopCollectionQuery) {
    return this.getCollection(
      '/v2/activity/workout',
      accessToken,
      query,
      whoopWorkoutCollectionSchema,
      'workouts'
    );
  }

  private async getCollection<T>(
    path: string,
    accessToken: string,
    query: WhoopCollectionQuery,
    schema: z.ZodType<T>,
    dataset: string
  ): Promise<T> {
    const url = new URL(`${this.config.apiBaseUrl}${path}`);
    url.searchParams.set('start', query.start);
    url.searchParams.set('end', query.end);
    url.searchParams.set('limit', String(query.limit ?? 25));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    let response: Response;

    try {
      response = await this.httpClient.fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        signal: controller.signal
      });
    } catch (error) {
      const timedOut =
        controller.signal.aborted || (error instanceof Error && error.name === 'AbortError');
      this.logger.warn(
        `WHOOP data request failed; dataset=${dataset}; reason=${timedOut ? 'timeout' : 'network'}`
      );
      throw new WhoopError(
        'WHOOP_PROVIDER_UNAVAILABLE',
        timedOut ? 'WHOOP data request timed out.' : 'WHOOP is temporarily unavailable.'
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401) {
      throw new WhoopError(
        'WHOOP_REAUTH_REQUIRED',
        'WHOOP authorization needs to be renewed.',
        response.status
      );
    }

    if (!response.ok) {
      this.logger.warn(`WHOOP data request failed; dataset=${dataset}; status=${response.status}`);
      throw new WhoopError(
        response.status === 429 || response.status >= 500
          ? 'WHOOP_PROVIDER_UNAVAILABLE'
          : 'WHOOP_DATA_REQUEST_FAILED',
        'WHOOP data could not be read.',
        response.status
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new WhoopError(
        'WHOOP_DATA_RESPONSE_INVALID',
        'WHOOP returned an invalid data response.'
      );
    }

    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      this.logger.warn(`WHOOP data response validation failed; dataset=${dataset}`);
      throw new WhoopError(
        'WHOOP_DATA_RESPONSE_INVALID',
        'WHOOP returned an invalid data response.'
      );
    }

    return parsed.data;
  }
}
