import { WebhookDeliveryStatus } from './webhook-delivery-status.enum';
import { WebhookEventType } from './webhook-event-type.enum';

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: WebhookEventType;
  source?: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  responseStatus?: number;
  responseBody?: string;
  error?: string;
  durationMs?: number;
  createdAt: Date;
  deliveredAt?: Date;
}
