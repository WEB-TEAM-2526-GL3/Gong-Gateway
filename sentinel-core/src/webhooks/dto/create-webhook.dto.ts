import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import { WebhookEventType } from '../types/webhook-event-type.enum';
import { WebhookProvider } from '../types/webhook-provider.enum';

export class CreateWebhookDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsEnum(WebhookProvider)
  provider?: WebhookProvider;

  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  url!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(WebhookEventType, { each: true })
  eventTypes!: WebhookEventType[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  maxRetries?: number;
}
