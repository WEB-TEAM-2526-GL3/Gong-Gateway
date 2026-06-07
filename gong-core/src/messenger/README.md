# Messenger Module

## Purpose

`MessengerModule` handles inbound Meta Messenger webhook verification and event
capture. It is for receiving Messenger events from Meta, not for sending
outbound Messenger messages.

## Key Files

| File | Role |
| --- | --- |
| `messenger.module.ts` | Registers the controller, service, and in-memory repository. |
| `messenger-webhook.controller.ts` | Exposes `/messenger` webhook and debug endpoints. |
| `messenger-webhook.service.ts` | Verifies Meta challenge requests and extracts inbound events. |
| `messenger-events.repository.ts` | Stores inbound Messenger events in memory. |
| `dto/messenger-webhook-query.dto.ts` | Query contract for Meta verification. |
| `types/messenger-inbound-event.model.ts` | Internal and public event shapes. |

## HTTP API

Base path: `/messenger`

| Method | Path | Input | Output |
| --- | --- | --- | --- |
| `GET` | `/webhook` | Meta query params | Plain text `hub.challenge` if token matches. |
| `POST` | `/webhook` | Meta webhook body | Plain text `EVENT_RECEIVED`. |
| `GET` | `/events` | Optional `senderId`, `limit` | Array of public inbound events. |
| `GET` | `/recipients` | None | Array of sender summaries. |

## Verification Input

Meta calls:

```http
GET /messenger/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<challenge>
```

The service checks:

- `hub.mode === "subscribe"`
- `hub.verify_token === process.env.MESSENGER_VERIFY_TOKEN`

If both are valid, the output is the challenge string as `text/plain`.
Invalid verification returns `403 Forbidden`.

## Incoming Event Handling

The module reads entries from the standard Meta shape:

```json
{
  "entry": [
    {
      "messaging": [
        {
          "sender": { "id": "PSID" },
          "recipient": { "id": "PAGE_ID" },
          "timestamp": 1710000000000,
          "message": { "text": "hello" },
          "postback": { "payload": "PAYLOAD" }
        }
      ]
    }
  ]
}
```

For each messaging item it stores:

- `senderId`
- `recipientId`
- `messageText`
- `postbackPayload`
- `timestamp`
- `receivedAt`
- raw event item

## Outputs

`GET /messenger/events` returns public events without the raw Meta payload.

`GET /messenger/recipients` returns one row per sender:

```ts
{
  senderId: string;
  lastMessageText?: string;
  lastSeenAt: Date;
}
```

## Persistence

The repository is in memory only. Messenger events and recipient summaries are
lost on backend restart.

## Notes

- Page access tokens and outbound Messenger sends are not implemented.
- The debug endpoints are not currently JWT-protected.
