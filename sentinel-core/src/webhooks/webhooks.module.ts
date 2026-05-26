import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { WebhookDeliveriesController } from './webhook-deliveries.controller';
import { WebhooksController } from './webhooks.controller';
import { WebhooksRepository } from './webhooks.repository';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [HttpModule],
  controllers: [WebhooksController, WebhookDeliveriesController],
  providers: [WebhooksService, WebhooksRepository],
  exports: [WebhooksService],
})
export class WebhooksModule {}
