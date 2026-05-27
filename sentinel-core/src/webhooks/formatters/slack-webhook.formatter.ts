import {
  WebhookPayloadFormatter,
  WebhookPayloadFormatterInput,
} from './webhook-payload-formatter.interface';

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  elements?: Array<{
    type: string;
    text: string;
  }>;
}

export class SlackWebhookFormatter implements WebhookPayloadFormatter {
  format(input: WebhookPayloadFormatterInput): Record<string, unknown> {
    const summary = this.buildSummary(input.payload);

    return {
      text: `[${input.eventType}] ${summary}`,
      blocks: this.buildBlocks(input, summary),
    };
  }

  private buildBlocks(
    input: WebhookPayloadFormatterInput,
    summary: string,
  ): SlackBlock[] {
    const blocks: SlackBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${input.eventType}*\n${summary}`,
        },
      },
    ];

    if (input.source) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Source: ${input.source}`,
          },
        ],
      });
    }

    return blocks;
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
    if (status && serviceName) return `${status} - ${serviceName}`;

    try {
      return JSON.stringify(payload).slice(0, 300);
    } catch {
      return 'Sentinel Gateway event';
    }
  }

  private getString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
