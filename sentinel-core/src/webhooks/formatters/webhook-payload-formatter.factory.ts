import { Injectable } from '@nestjs/common';
import { WebhookProvider } from '../types/webhook-provider.enum';
import { DiscordWebhookFormatter } from './discord-webhook.formatter';
import { GenericWebhookFormatter } from './generic-webhook.formatter';
import { WebhookPayloadFormatter } from './webhook-payload-formatter.interface';

@Injectable()
export class WebhookPayloadFormatterFactory {
  private readonly generic = new GenericWebhookFormatter();
  private readonly discord = new DiscordWebhookFormatter();

  getFormatter(provider: WebhookProvider): WebhookPayloadFormatter {
    if (provider === WebhookProvider.DISCORD) {
      return this.discord;
    }

    return this.generic;
  }
}
