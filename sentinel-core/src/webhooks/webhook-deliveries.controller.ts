import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ListDeliveriesQueryDto } from './dto/list-deliveries-query.dto';
import { WebhookAdminGuard } from './guards/webhook-admin.guard';
import { WebhookDelivery } from './types/webhook-delivery.model';
import { WebhooksService } from './webhooks.service';

@Controller('webhook-deliveries')
@UseGuards(WebhookAdminGuard)
export class WebhookDeliveriesController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  listDeliveries(@Query() query: ListDeliveriesQueryDto): {
    data: WebhookDelivery[];
  } {
    return { data: this.webhooks.listDeliveries(query) };
  }
}
