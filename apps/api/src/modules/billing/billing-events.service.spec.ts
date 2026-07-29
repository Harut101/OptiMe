import {
  BillingEventProcessingStatus,
  BillingEventProvider,
  Prisma
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BillingEventsService } from './billing-events.service';

describe('BillingEventsService', () => {
  const create = jest.fn();
  const findUniqueOrThrow = jest.fn();
  const update = jest.fn();
  const prisma = {
    billingEvent: {
      create,
      findUniqueOrThrow,
      update
    }
  } as unknown as PrismaService;
  const service = new BillingEventsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records safe metadata without a raw payload field', async () => {
    create.mockResolvedValue({ id: 'event-1' });

    await expect(
      service.recordReceived({
        provider: BillingEventProvider.REVENUECAT,
        providerEventId: 'rc-event-1',
        eventType: 'INITIAL_PURCHASE',
        providerCustomerId: 'customer-1',
        providerProductId: 'com.optime.app.plus.monthly'
      })
    ).resolves.toEqual({
      event: { id: 'event-1' },
      duplicate: false
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerEventId: 'rc-event-1',
        status: BillingEventProcessingStatus.RECEIVED
      })
    });
    expect(create.mock.calls[0][0].data).not.toHaveProperty('rawBody');
    expect(create.mock.calls[0][0].data).not.toHaveProperty('receipt');
  });

  it('returns the original row when the provider replays an event', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test'
      })
    );
    findUniqueOrThrow.mockResolvedValue({ id: 'event-1' });

    await expect(
      service.recordReceived({
        provider: BillingEventProvider.REVENUECAT,
        providerEventId: 'rc-event-1',
        eventType: 'RENEWAL'
      })
    ).resolves.toEqual({
      event: { id: 'event-1' },
      duplicate: true
    });

    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        provider_providerEventId: {
          provider: BillingEventProvider.REVENUECAT,
          providerEventId: 'rc-event-1'
        }
      }
    });
  });

  it('stores only a bounded safe error code for failed processing', async () => {
    update.mockResolvedValue({ id: 'event-1' });

    await service.markFailed('event-1', 'provider_auth_failed');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: expect.objectContaining({
        status: BillingEventProcessingStatus.FAILED,
        safeErrorCode: 'provider_auth_failed'
      })
    });
  });
});
