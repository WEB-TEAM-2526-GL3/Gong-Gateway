import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { WebhookPayloadFormatterFactory } from './formatters/webhook-payload-formatter.factory';
import { WebhookDeliveriesController } from './webhook-deliveries.controller';
import { WebhooksController } from './webhooks.controller';
import { WebhooksRepository } from './webhooks.repository';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [HttpModule],
  controllers: [WebhooksController, WebhookDeliveriesController],
  providers: [
    WebhooksService,
    WebhooksRepository,
    WebhookPayloadFormatterFactory,
  ],
  exports: [WebhooksService],
})
export class WebhooksModule {}
