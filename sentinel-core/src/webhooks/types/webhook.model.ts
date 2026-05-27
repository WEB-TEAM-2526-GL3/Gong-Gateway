import { WebhookEventType } from './webhook-event-type.enum';
import { WebhookProvider } from './webhook-provider.enum';

export interface Webhook {
  id: string;
  name: string;
  provider: WebhookProvider;
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
  provider: WebhookProvider;
  url: string;
  eventTypes: WebhookEventType[];
  isActive: boolean;
  hasSecret: boolean;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}
