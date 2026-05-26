import { Controller, Get, Query } from '@nestjs/common';
import { ListDeliveriesQueryDto } from './dto/list-deliveries-query.dto';
import { WebhookDelivery } from './types/webhook-delivery.model';
import { WebhooksService } from './webhooks.service';

@Controller('webhook-deliveries')
export class WebhookDeliveriesController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  listDeliveries(@Query() query: ListDeliveriesQueryDto): {
    data: WebhookDelivery[];
  } {
    return { data: this.webhooks.listDeliveries(query) };
  }
}
