import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { EmitWebhookEventDto } from './dto/emit-webhook-event.dto';
import { ListWebhooksQueryDto } from './dto/list-webhooks-query.dto';
import { TestWebhookDto } from './dto/test-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import type { WebhookDelivery } from './types/webhook-delivery.model';
import type { WebhookEventType } from './types/webhook-event-type.enum';
import type { PublicWebhook } from './types/webhook.model';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post()
  createWebhook(@Body() body: CreateWebhookDto): PublicWebhook {
    return this.webhooks.createWebhook(body);
  }

  @Get()
  listWebhooks(@Query() query: ListWebhooksQueryDto): {
    data: PublicWebhook[];
  } {
    return { data: this.webhooks.listWebhooks(query) };
  }

  @Get('event-types')
  listEventTypes(): { data: WebhookEventType[] } {
    return { data: this.webhooks.listEventTypes() };
  }

  @Post('emit')
  @HttpCode(HttpStatus.OK)
  emit(@Body() body: EmitWebhookEventDto) {
    return this.webhooks.emit(body);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  testWebhook(
    @Param('id') id: string,
    @Body() body: TestWebhookDto,
  ): Promise<WebhookDelivery> {
    return this.webhooks.testWebhook(id, body);
  }

  @Get(':id')
  getWebhook(@Param('id') id: string): PublicWebhook {
    return this.webhooks.getWebhook(id);
  }

  @Patch(':id')
  updateWebhook(
    @Param('id') id: string,
    @Body() body: UpdateWebhookDto,
  ): PublicWebhook {
    return this.webhooks.updateWebhook(id, body);
  }

  @Delete(':id')
  deactivateWebhook(@Param('id') id: string): PublicWebhook {
    return this.webhooks.deactivateWebhook(id);
  }
}
