import { Injectable } from '@nestjs/common';
import {
  BillingEventProcessingStatus,
  BillingEventProvider,
  Prisma,
  SubscriptionEnvironment,
  SubscriptionProvider
} from '@prisma/client';
import type { BillingLifecycleEventType } from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';

export interface RecordBillingEventInput {
  provider: BillingEventProvider;
  providerEventId: string;
  eventType: BillingLifecycleEventType;
  environment?: SubscriptionEnvironment | null;
  store?: SubscriptionProvider | null;
  userId?: string | null;
  subscriptionId?: string | null;
  providerCustomerId?: string | null;
  providerProductId?: string | null;
  occurredAt?: Date | null;
}

@Injectable()
export class BillingEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordReceived(input: RecordBillingEventInput) {
    const providerEventId = requireIdentifier(
      input.providerEventId,
      'providerEventId'
    );

    try {
      const event = await this.prisma.billingEvent.create({
        data: {
          provider: input.provider,
          providerEventId,
          eventType: input.eventType,
          status: BillingEventProcessingStatus.RECEIVED,
          environment: input.environment ?? null,
          store: input.store ?? null,
          userId: input.userId ?? null,
          subscriptionId: input.subscriptionId ?? null,
          providerCustomerId: optionalIdentifier(input.providerCustomerId),
          providerProductId: optionalIdentifier(input.providerProductId),
          occurredAt: input.occurredAt ?? null
        }
      });

      return { event, duplicate: false };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      const event = await this.prisma.billingEvent.findUniqueOrThrow({
        where: {
          provider_providerEventId: {
            provider: input.provider,
            providerEventId
          }
        }
      });

      return { event, duplicate: true };
    }
  }

  markProcessed(id: string, subscriptionId?: string | null) {
    return this.prisma.billingEvent.update({
      where: { id },
      data: {
        status: BillingEventProcessingStatus.PROCESSED,
        subscriptionId: subscriptionId ?? undefined,
        processedAt: new Date(),
        safeErrorCode: null
      }
    });
  }

  markIgnored(id: string) {
    return this.prisma.billingEvent.update({
      where: { id },
      data: {
        status: BillingEventProcessingStatus.IGNORED,
        processedAt: new Date(),
        safeErrorCode: null
      }
    });
  }

  markFailed(id: string, safeErrorCode: string) {
    return this.prisma.billingEvent.update({
      where: { id },
      data: {
        status: BillingEventProcessingStatus.FAILED,
        processedAt: new Date(),
        safeErrorCode: requireIdentifier(safeErrorCode, 'safeErrorCode', 100)
      }
    });
  }
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function requireIdentifier(value: string, name: string, maximumLength = 255) {
  const normalized = value.trim();

  if (!normalized || normalized.length > maximumLength) {
    throw new Error(`${name} must contain between 1 and ${maximumLength} characters.`);
  }

  return normalized;
}

function optionalIdentifier(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, 255) : null;
}
