import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { WebhookEventType } from '../types/webhook-event-type.enum';

export class EmitWebhookEventDto {
  @IsEnum(WebhookEventType)
  eventType!: WebhookEventType;

  @IsOptional()
  @IsString()
  source?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
