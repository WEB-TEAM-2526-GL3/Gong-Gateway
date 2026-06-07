import { WebhookEventType } from '../types/webhook-event-type.enum';

export interface WebhookPayloadFormatterInput {
  eventType: WebhookEventType;
  source?: string;
  payload: Record<string, unknown>;
}

export interface WebhookPayloadFormatter {
  format(input: WebhookPayloadFormatterInput): Record<string, unknown>;
}
