import {
  WebhookPayloadFormatter,
  WebhookPayloadFormatterInput,
} from './webhook-payload-formatter.interface';

interface DiscordEmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export class DiscordWebhookFormatter implements WebhookPayloadFormatter {
  format(input: WebhookPayloadFormatterInput): Record<string, unknown> {
    const summary = this.buildSummary(input.payload);
    const fields = this.buildFields(input);

    return {
      content: `[${input.eventType}] ${summary}`,
      embeds: [
        {
          title: input.eventType,
          description: summary,
          fields,
        },
      ],
    };
  }

  private buildSummary(payload: Record<string, unknown>): string {
    const reason = this.getString(payload.reason);
    if (reason) return reason;

    const message = this.getString(payload.message);
    if (message) return message;

    const error = this.getString(payload.error);
    if (error) return error;

    const status = this.getString(payload.status);
    const serviceName = this.getString(payload.serviceName);
    if (status && serviceName) return `${status} ${serviceName}`;

    try {
      return JSON.stringify(payload).slice(0, 300);
    } catch {
      return 'Sentinel Gateway event';
    }
  }

  private buildFields(
    input: WebhookPayloadFormatterInput,
  ): DiscordEmbedField[] {
    const fields: DiscordEmbedField[] = [];

    if (input.source) {
      fields.push({
        name: 'Source',
        value: input.source,
        inline: true,
      });
    }

    const status = this.getString(input.payload.status);
    if (status) {
      fields.push({
        name: 'Status',
        value: status,
        inline: true,
      });
    }

    return fields;
  }

  private getString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
