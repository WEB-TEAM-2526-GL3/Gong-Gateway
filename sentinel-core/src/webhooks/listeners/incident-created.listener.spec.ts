import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { IncidentCreatedListener } from './incident-created.listener';
import { WebhooksService } from '../webhooks.service';

describe('IncidentCreatedListener', () => {
  const webhooksServiceMock = {
    emit: jest.fn(),
  };

  let listener: IncidentCreatedListener;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        IncidentCreatedListener,
        {
          provide: WebhooksService,
          useValue: webhooksServiceMock,
        },
      ],
    }).compile();

    listener = moduleRef.get(IncidentCreatedListener);
  });

  it('forwards incident-created events to the webhook emitter', async () => {
    await listener.handleIncidentCreated({
      id: 'inc_001',
      reason: 'dead',
      timestamp: new Date('2026-05-29T10:00:00.000Z'),
    });

    expect(webhooksServiceMock.emit).toHaveBeenCalledWith({
      eventType: 'INCIDENT_CREATED',
      source: 'IncidentModule',
      payload: {
        incidentId: 'inc_001',
        reason: 'dead',
        status: 'OPEN',
        timestamp: '2026-05-29T10:00:00.000Z',
      },
    });
  });
});
