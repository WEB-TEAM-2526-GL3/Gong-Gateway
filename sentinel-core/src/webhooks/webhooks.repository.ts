import { Injectable } from '@nestjs/common';
import { WebhookDeliveryStatus } from './types/webhook-delivery-status.enum';
import { WebhookDelivery } from './types/webhook-delivery.model';
import { WebhookEventType } from './types/webhook-event-type.enum';
import { WebhookProvider } from './types/webhook-provider.enum';
import { Webhook } from './types/webhook.model';

interface CreateWebhookRecord {
  name: string;
  provider: WebhookProvider;
  url: string;
  eventTypes: WebhookEventType[];
  isActive: boolean;
  secret?: string;
  maxRetries: number;
}

interface UpdateWebhookRecord {
  name?: string;
  provider?: WebhookProvider;
  url?: string;
  eventTypes?: WebhookEventType[];
  isActive?: boolean;
  secret?: string;
  maxRetries?: number;
}

interface WebhookFilters {
  isActive?: boolean;
  eventType?: WebhookEventType;
}

interface DeliveryFilters {
  webhookId?: string;
  eventType?: WebhookEventType;
  status?: WebhookDeliveryStatus;
}

@Injectable()
export class WebhooksRepository {
  private readonly webhooks = new Map<string, Webhook>();
  private readonly deliveries = new Map<string, WebhookDelivery>();
  private webhookSequence = 0;
  private deliverySequence = 0;

  createWebhook(input: CreateWebhookRecord): Webhook {
    const now = new Date();
    const webhook: Webhook = {
      id: this.nextWebhookId(),
      name: input.name,
      provider: input.provider,
      url: input.url,
      eventTypes: [...input.eventTypes],
      isActive: input.isActive,
      secret: input.secret,
      maxRetries: input.maxRetries,
      createdAt: now,
      updatedAt: now,
    };

    this.webhooks.set(webhook.id, webhook);
    return this.cloneWebhook(webhook);
  }

  listWebhooks(filters: WebhookFilters = {}): Webhook[] {
    return Array.from(this.webhooks.values())
      .filter((webhook) =>
        filters.isActive === undefined
          ? true
          : webhook.isActive === filters.isActive,
      )
      .filter((webhook) =>
        filters.eventType === undefined
          ? true
          : webhook.eventTypes.includes(filters.eventType),
      )
      .map((webhook) => this.cloneWebhook(webhook));
  }

  findWebhook(id: string): Webhook | null {
    const webhook = this.webhooks.get(id);
    return webhook ? this.cloneWebhook(webhook) : null;
  }

  updateWebhook(id: string, updates: UpdateWebhookRecord): Webhook | null {
    const webhook = this.webhooks.get(id);
    if (!webhook) return null;

    const updated: Webhook = {
      ...webhook,
      name: updates.name ?? webhook.name,
      provider: updates.provider ?? webhook.provider,
      url: updates.url ?? webhook.url,
      eventTypes: updates.eventTypes
        ? [...updates.eventTypes]
        : webhook.eventTypes,
      isActive: updates.isActive ?? webhook.isActive,
      secret: updates.secret ?? webhook.secret,
      maxRetries: updates.maxRetries ?? webhook.maxRetries,
      updatedAt: new Date(),
    };

    this.webhooks.set(id, updated);
    return this.cloneWebhook(updated);
  }

  createDelivery(input: Omit<WebhookDelivery, 'id'>): WebhookDelivery {
    const delivery: WebhookDelivery = {
      ...input,
      id: this.nextDeliveryId(),
      payload: { ...input.payload },
      createdAt: new Date(input.createdAt),
      deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : undefined,
    };

    this.deliveries.set(delivery.id, delivery);
    return this.cloneDelivery(delivery);
  }

  listDeliveries(filters: DeliveryFilters = {}): WebhookDelivery[] {
    return Array.from(this.deliveries.values())
      .filter((delivery) =>
        filters.webhookId === undefined
          ? true
          : delivery.webhookId === filters.webhookId,
      )
      .filter((delivery) =>
        filters.eventType === undefined
          ? true
          : delivery.eventType === filters.eventType,
      )
      .filter((delivery) =>
        filters.status === undefined
          ? true
          : delivery.status === filters.status,
      )
      .map((delivery) => this.cloneDelivery(delivery));
  }

  private nextWebhookId(): string {
    this.webhookSequence += 1;
    return `wh_${String(this.webhookSequence).padStart(3, '0')}`;
  }

  private nextDeliveryId(): string {
    this.deliverySequence += 1;
    return `del_${String(this.deliverySequence).padStart(3, '0')}`;
  }

  private cloneWebhook(webhook: Webhook): Webhook {
    return {
      ...webhook,
      eventTypes: [...webhook.eventTypes],
      createdAt: new Date(webhook.createdAt),
      updatedAt: new Date(webhook.updatedAt),
    };
  }

  private cloneDelivery(delivery: WebhookDelivery): WebhookDelivery {
    return {
      ...delivery,
      payload: { ...delivery.payload },
      createdAt: new Date(delivery.createdAt),
      deliveredAt: delivery.deliveredAt
        ? new Date(delivery.deliveredAt)
        : undefined,
    };
  }
}
