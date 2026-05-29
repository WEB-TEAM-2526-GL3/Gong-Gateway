import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { WebhookEventType } from '../types/webhook-event-type.enum';

const toOptionalBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

export class ListWebhooksQueryDto {
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(WebhookEventType)
  eventType?: WebhookEventType;
}
