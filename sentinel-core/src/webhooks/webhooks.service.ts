import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { createHmac } from 'node:crypto';
import { firstValueFrom } from 'rxjs';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { EmitWebhookEventDto } from './dto/emit-webhook-event.dto';
import { ListDeliveriesQueryDto } from './dto/list-deliveries-query.dto';
import { ListWebhooksQueryDto } from './dto/list-webhooks-query.dto';
import { TestWebhookDto } from './dto/test-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhookDeliveryStatus } from './types/webhook-delivery-status.enum';
import { WebhookDelivery } from './types/webhook-delivery.model';
import { WebhookEventType } from './types/webhook-event-type.enum';
import { PublicWebhook, Webhook } from './types/webhook.model';
import { WebhooksRepository } from './webhooks.repository';

export interface DeliverySummary {
  id: string;
  webhookId: string;
  status: WebhookDeliveryStatus;
  attemptCount: number;
}

export interface EmitResult {
  eventType: WebhookEventType;
  matchedWebhooks: number;
  deliveries: DeliverySummary[];
}

interface OutgoingWebhookPayload {
  event: WebhookEventType;
  source?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

@Injectable()
export class WebhooksService {
  constructor(
    private readonly repository: WebhooksRepository,
    private readonly http: HttpService,
  ) {}

  createWebhook(body: CreateWebhookDto): PublicWebhook {
    this.assertHttpUrl(body.url);

    const webhook = this.repository.createWebhook({
      name: body.name,
      url: body.url,
      eventTypes: body.eventTypes,
      isActive: body.isActive ?? true,
      secret: body.secret,
      maxRetries: body.maxRetries ?? 3,
    });

    return this.toPublicWebhook(webhook);
  }

  listWebhooks(query: ListWebhooksQueryDto): PublicWebhook[] {
    return this.repository
      .listWebhooks({
        isActive: query.isActive,
        eventType: query.eventType,
      })
      .map((webhook) => this.toPublicWebhook(webhook));
  }

  listEventTypes(): WebhookEventType[] {
    return Object.values(WebhookEventType);
  }

  getWebhook(id: string): PublicWebhook {
    return this.toPublicWebhook(this.getWebhookOrThrow(id));
  }

  updateWebhook(id: string, body: UpdateWebhookDto): PublicWebhook {
    if (body.url !== undefined) {
      this.assertHttpUrl(body.url);
    }

    const webhook = this.repository.updateWebhook(id, {
      name: body.name,
      url: body.url,
      eventTypes: body.eventTypes,
      isActive: body.isActive,
      secret: body.secret,
      maxRetries: body.maxRetries,
    });

    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} was not found`);
    }

    return this.toPublicWebhook(webhook);
  }

  deactivateWebhook(id: string): PublicWebhook {
    const webhook = this.repository.updateWebhook(id, { isActive: false });

    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} was not found`);
    }

    return this.toPublicWebhook(webhook);
  }

  async testWebhook(
    id: string,
    body: TestWebhookDto,
  ): Promise<WebhookDelivery> {
    const webhook = this.getWebhookOrThrow(id);

    return this.deliverToWebhook(
      webhook,
      WebhookEventType.ADMIN_ACTION,
      'WebhookService',
      body.payload ?? {
        message: 'Sentinel Gateway webhook test',
        webhookId: id,
      },
    );
  }

  async emit(body: EmitWebhookEventDto): Promise<EmitResult> {
    const matchingWebhooks = this.repository.listWebhooks({
      isActive: true,
      eventType: body.eventType,
    });

    const deliveries = await Promise.all(
      matchingWebhooks.map((webhook) =>
        this.deliverToWebhook(
          webhook,
          body.eventType,
          body.source,
          body.payload,
        ),
      ),
    );

    return {
      eventType: body.eventType,
      matchedWebhooks: matchingWebhooks.length,
      deliveries: deliveries.map((delivery) =>
        this.toDeliverySummary(delivery),
      ),
    };
  }

  listDeliveries(query: ListDeliveriesQueryDto): WebhookDelivery[] {
    return this.repository.listDeliveries({
      webhookId: query.webhookId,
      eventType: query.eventType,
      status: query.status,
    });
  }

  private async deliverToWebhook(
    webhook: Webhook,
    eventType: WebhookEventType,
    source: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<WebhookDelivery> {
    const createdAt = new Date();
    const outgoingPayload: OutgoingWebhookPayload = {
      event: eventType,
      source,
      timestamp: createdAt.toISOString(),
      data: payload,
    };
    const body = JSON.stringify(outgoingPayload);
    const maxAttempts = Math.max(1, webhook.maxRetries + 1);

    let attemptCount = 0;
    let status = WebhookDeliveryStatus.FAILED;
    let responseStatus: number | undefined;
    let responseBody: string | undefined;
    let errorMessage: string | undefined;
    let durationMs: number | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      attemptCount = attempt;
      const startedAt = Date.now();

      try {
        const response = await firstValueFrom(
          this.http.post<string>(webhook.url, body, {
            headers: this.buildHeaders(webhook, eventType, body),
            responseType: 'text',
            timeout: 3000,
            transformResponse: [(data: unknown) => data as string],
            validateStatus: () => true,
          }),
        );

        durationMs = Date.now() - startedAt;
        responseStatus = response.status;
        responseBody = this.serializeResponseBody(response.data);

        if (response.status >= 200 && response.status < 300) {
          status = WebhookDeliveryStatus.SUCCESS;
          errorMessage = undefined;
          break;
        }

        errorMessage = `Webhook returned status ${response.status}`;
      } catch (error) {
        durationMs = Date.now() - startedAt;
        const axiosError = error as AxiosError;
        responseStatus = axiosError.response?.status;
        responseBody = this.serializeResponseBody(axiosError.response?.data);
        errorMessage = axiosError.message;
      }

      if (attempt < maxAttempts) {
        await this.delay(25 * attempt);
      }
    }

    return this.repository.createDelivery({
      webhookId: webhook.id,
      eventType,
      source,
      payload,
      status,
      attemptCount,
      responseStatus,
      responseBody,
      error: errorMessage,
      durationMs,
      createdAt,
      deliveredAt:
        status === WebhookDeliveryStatus.SUCCESS ? new Date() : undefined,
    });
  }

  private buildHeaders(
    webhook: Webhook,
    eventType: WebhookEventType,
    body: string,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Sentinel-Event': eventType,
    };

    if (webhook.secret) {
      headers['X-Sentinel-Signature'] = this.signBody(body, webhook.secret);
    }

    return headers;
  }

  private signBody(body: string, secret: string): string {
    return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  }

  private getWebhookOrThrow(id: string): Webhook {
    const webhook = this.repository.findWebhook(id);

    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} was not found`);
    }

    return webhook;
  }

  private assertHttpUrl(url: string): void {
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('URL must use HTTP or HTTPS');
      }
    } catch {
      throw new BadRequestException(
        'Webhook URL must be a valid HTTP/HTTPS URL',
      );
    }
  }

  private toPublicWebhook(webhook: Webhook): PublicWebhook {
    return {
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      eventTypes: [...webhook.eventTypes],
      isActive: webhook.isActive,
      hasSecret: Boolean(webhook.secret),
      maxRetries: webhook.maxRetries,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    };
  }

  private toDeliverySummary(delivery: WebhookDelivery): DeliverySummary {
    return {
      id: delivery.id,
      webhookId: delivery.webhookId,
      status: delivery.status,
      attemptCount: delivery.attemptCount,
    };
  }

  private serializeResponseBody(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') return value.slice(0, 1000);

    try {
      return JSON.stringify(value).slice(0, 1000);
    } catch {
      return '[unserializable response body]';
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
