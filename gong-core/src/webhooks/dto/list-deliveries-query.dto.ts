import { IsEnum, IsOptional, IsString } from 'class-validator';
import { WebhookDeliveryStatus } from '../types/webhook-delivery-status.enum';
import { WebhookEventType } from '../types/webhook-event-type.enum';

export class ListDeliveriesQueryDto {
  @IsOptional()
  @IsString()
  webhookId?: string;

  @IsOptional()
  @IsEnum(WebhookEventType)
  eventType?: WebhookEventType;

  @IsOptional()
  @IsEnum(WebhookDeliveryStatus)
  status?: WebhookDeliveryStatus;
}
