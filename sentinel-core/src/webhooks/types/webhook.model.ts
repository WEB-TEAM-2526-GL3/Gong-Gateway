import { WebhookEventType } from './webhook-event-type.enum';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  eventTypes: WebhookEventType[];
  isActive: boolean;
  secret?: string;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicWebhook {
  id: string;
  name: string;
  url: string;
  eventTypes: WebhookEventType[];
  isActive: boolean;
  hasSecret: boolean;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}
