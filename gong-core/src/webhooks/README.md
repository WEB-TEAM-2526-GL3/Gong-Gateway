# Webhooks Module

## Purpose

`WebhooksModule` is Gong's outbound notification module. It lets admins
configure HTTP webhooks and lets internal producers emit business events to all
active webhook subscriptions.

It supports provider-specific payload formatting for generic webhooks, Discord,
and Slack.

## Key Files

| File                                     | Role                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| `webhooks.module.ts`                     | Registers controllers, service, repository, formatter factory, guard, and incident listener. |
| `webhooks.controller.ts`                 | Exposes webhook management and event emission routes.                                        |
| `webhook-deliveries.controller.ts`       | Exposes delivery history.                                                                    |
| `webhooks.service.ts`                    | Creates configs, dispatches events, signs requests, retries, records deliveries.             |
| `webhooks.repository.ts`                 | In-memory repository for webhook configs and delivery history.                               |
| `guards/webhook-admin.guard.ts`          | Protects admin routes with `X-Gong-Admin-Key`.                                               |
| `listeners/incident-created.listener.ts` | Bridges `incident.created` events to outbound webhooks.                                      |
| `formatters/*.ts`                        | Generic, Discord, and Slack payload formatters.                                              |
| `dto/*.ts`                               | Validated input and query contracts.                                                         |
| `types/*.ts`                             | Webhook, delivery, provider, and event type contracts.                                       |

## Admin Authentication

Admin management routes require:

```http
X-Gong-Admin-Key: <WEBHOOK_ADMIN_KEY>
```

The key is compared against `process.env.WEBHOOK_ADMIN_KEY` with constant-time
comparison.

## HTTP API

### Webhook Configs

Base path: `/webhooks`

| Method   | Path           | Auth      | Input                                  | Output                             |
| -------- | -------------- | --------- | -------------------------------------- | ---------------------------------- |
| `POST`   | `/`            | Admin key | `CreateWebhookDto`                     | Public webhook config.             |
| `GET`    | `/`            | Admin key | Optional query `isActive`, `eventType` | `{ data: PublicWebhook[] }`.       |
| `GET`    | `/event-types` | Admin key | None                                   | `{ data: WebhookEventType[] }`.    |
| `GET`    | `/:id`         | Admin key | Path id                                | Public webhook config.             |
| `PATCH`  | `/:id`         | Admin key | `UpdateWebhookDto`                     | Public webhook config.             |
| `DELETE` | `/:id`         | Admin key | Path id                                | Deactivated public webhook config. |
| `POST`   | `/:id/test`    | Admin key | `{ payload? }`                         | Full delivery record.              |
| `POST`   | `/emit`        | None      | `EmitWebhookEventDto`                  | Event dispatch summary.            |

### Delivery History

Base path: `/webhook-deliveries`

| Method | Path | Auth      | Query                                       | Output                         |
| ------ | ---- | --------- | ------------------------------------------- | ------------------------------ |
| `GET`  | `/`  | Admin key | Optional `webhookId`, `eventType`, `status` | `{ data: WebhookDelivery[] }`. |

## Create Webhook Input

```ts
{
  name: string;
  provider?: "GENERIC" | "DISCORD" | "SLACK";
  url: string;
  eventTypes: WebhookEventType[];
  isActive?: boolean;
  secret?: string;
  maxRetries?: number;
}
```

Defaults:

- `provider`: `GENERIC`
- `isActive`: `true`
- `maxRetries`: `3`

Public responses never include `secret`. They include `hasSecret` instead.
Slack webhook URLs are masked in public responses.

## Emit Input And Output

Input:

```ts
{
  eventType: WebhookEventType;
  source?: string;
  payload: Record<string, unknown>;
}
```

Output:

```ts
{
  eventType: WebhookEventType;
  matchedWebhooks: number;
  deliveries: Array<{
    id: string;
    webhookId: string;
    status: 'SUCCESS' | 'FAILED' | 'PENDING';
    attemptCount: number;
  }>;
}
```

## Supported Event Types

- `INCIDENT_CREATED`
- `INCIDENT_ACKNOWLEDGED`
- `INCIDENT_RESOLVED`
- `PROVIDER_DOWN`
- `PROVIDER_RECOVERED`
- `BUDGET_WARNING`
- `BUDGET_EXCEEDED`
- `ERROR_RATE_HIGH`
- `ADMIN_ACTION`

## Outbound HTTP Request

For each matched active webhook, `WebhooksService`:

1. Formats the outgoing payload for the configured provider.
2. JSON serializes the body.
3. Adds headers:
   - `Content-Type: application/json`
   - `X-Gong-Event: <eventType>`
   - `X-Gong-Signature: sha256=<hmac>` when a secret exists
4. Sends `POST <webhook.url>`.
5. Retries up to `maxRetries` after the first attempt.
6. Records one delivery with status, attempts, response status/body, error, and duration.

HTTP `2xx` is considered success. Any other status or request error is recorded
as failed.

## Provider Payloads

### Generic

```json
{
  "event": "INCIDENT_CREATED",
  "source": "IncidentModule",
  "timestamp": "2026-05-29T10:00:00.000Z",
  "data": {}
}
```

### Discord

Uses Discord webhook-compatible `content` and `embeds`.

### Slack

Uses Slack Incoming Webhook-compatible `text` and `blocks`.

## Event Bridge

`IncidentCreatedListener` listens for:

```text
incident.created
```

and emits an outbound webhook event:

```text
INCIDENT_CREATED
```

with source:

```text
IncidentModule
```

## Persistence

Webhook configs and delivery history are stored in memory only. They are lost
when the backend restarts.

## Notes

- `/webhooks/emit` is currently not guarded. It is intended as an internal
  producer endpoint.
- `PENDING` exists as a delivery status enum but current sends finish during the
  request and record `SUCCESS` or `FAILED`.
