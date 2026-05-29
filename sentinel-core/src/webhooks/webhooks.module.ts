import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { WebhookPayloadFormatterFactory } from './formatters/webhook-payload-formatter.factory';
import { WebhookAdminGuard } from './guards/webhook-admin.guard';
import { IncidentCreatedListener } from './listeners/incident-created.listener';
import { WebhookDeliveriesController } from './webhook-deliveries.controller';
import { WebhooksController } from './webhooks.controller';
import { WebhooksRepository } from './webhooks.repository';
import { WebhooksService } from './webhooks.service';
import { MessengerModule } from '../messenger/messenger.module';

@Module({
  imports: [HttpModule, MessengerModule],
  controllers: [WebhooksController, WebhookDeliveriesController],
  providers: [
    WebhooksService,
    WebhooksRepository,
    WebhookPayloadFormatterFactory,
    WebhookAdminGuard,
    IncidentCreatedListener,
  ],
  exports: [WebhooksService],
})
export class WebhooksModule {}
