import { IsObject, IsOptional } from 'class-validator';

export class TestWebhookDto {
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
