import {
  WebhookPayloadFormatter,
  WebhookPayloadFormatterInput,
} from './webhook-payload-formatter.interface';

export class GenericWebhookFormatter implements WebhookPayloadFormatter {
  format(input: WebhookPayloadFormatterInput): Record<string, unknown> {
    return {
      event: input.eventType,
      source: input.source,
      timestamp: new Date().toISOString(),
      data: input.payload,
    };
  }
}
