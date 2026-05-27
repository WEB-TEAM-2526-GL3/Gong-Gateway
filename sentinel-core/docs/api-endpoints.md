# Sentinel API Endpoints

## Providers
- `GET /providers` — List all
- `GET /providers/:id` — Detail
- `POST /providers/generic` — Create generic
- `POST /providers/ai` — Create AI
- `PATCH /providers/:id` — Update
- `DELETE /providers/:id` — Archive
- `POST /providers/:id/rotate-secret` — Rotate secret

## Clients
- `GET /clients` — List all
- `GET /clients/:id` — Detail
- `POST /clients` — Create
- `PATCH /clients/:id` — Update
- `DELETE /clients/:id` — Archive

## Links
- `GET /clients/:id/links` — Get links for client
- `GET /providers/:id/links` — Get links for provider
- `POST /links` — Create link
- `POST /links/:id/activate` — Activate inactive link
- `POST /links/switch` — Switch primary
- `DELETE /links/:id` — Archive

## Limits
- `GET /limits/requests?clientId=&providerId=` — Get request limit
- `POST /limits/requests` — Set request limit
- `DELETE /limits/requests/:id` — Archive request limit
- `GET /limits/tokens/:providerId` — Get token limit
- `POST /limits/tokens` — Set token limit
- `DELETE /limits/tokens/:id` — Archive token limit

## Failover Rules
- `GET /failover-rules/:clientId` — Get rule
- `POST /failover-rules` — Set rule

## Incidents
- `GET /incidents?clientId=` — List incidents

## Dashboard
- `GET /dashboard/stream` — SSE overview
- `GET /dashboard/stream/clients/:id` — SSE client detail
- `GET /dashboard/stream/providers/:id` — SSE provider detail
- `GET /dashboard/stream/providers` — SSE provider list
- `GET /dashboard/history/requests` — REST history