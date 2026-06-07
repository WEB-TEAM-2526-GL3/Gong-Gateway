import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebhooksService } from '../webhooks.service';
import { WebhookEventType } from '../types/webhook-event-type.enum';
import {
  INCIDENT_CREATED_EVENT,
  type IncidentCreatedEvent,
} from '../events/incident-created.event';
import type { IncidentCreatedNotificationPayload } from '../types/incident-created-notification.payload';

@Injectable()
export class IncidentCreatedListener {
  constructor(private readonly webhooksService: WebhooksService) {}

  @OnEvent(INCIDENT_CREATED_EVENT)
  async handleIncidentCreated(event: IncidentCreatedEvent): Promise<void> {
    const payload: IncidentCreatedNotificationPayload = {
      incidentId: event.id,
      reason: event.reason,
      status: 'OPEN',
      timestamp: event.timestamp.toISOString(),
    };

    await this.webhooksService.emit({
      eventType: WebhookEventType.INCIDENT_CREATED,
      source: 'IncidentModule',
      payload,
    });
  }
}
