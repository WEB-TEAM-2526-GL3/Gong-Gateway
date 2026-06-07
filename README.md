# Gong Gateway

Gong Gateway is a control and observability platform for an API Gateway environment. It brings together Kong, Prometheus, a NestJS backend, a GraphQL API, a unified dashboard, and a realtime incident room.

The goal is to give operators a clear view of traffic, exposed services, incidents, monitoring alerts, webhooks, and external integrations without forcing them to jump between many tools.

## Overview

The repository is organized around two main applications:

| Folder          | Purpose                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `gong-core`     | NestJS backend, REST API, GraphQL API, SSE metrics, Socket.IO incident room gateway, and Kong/Prometheus/Webhooks/Messenger integrations. |
| `incident-room` | React/Vite frontend dedicated to realtime incident collaboration.                                                                         |

The local infrastructure is described in `docker-compose.yml`:

| Service           |   Port | Purpose                                       |
| ----------------- | -----: | --------------------------------------------- |
| Gong Core         | `3000` | Backend API, unified dashboard, GraphQL, SSE. |
| Incident Room dev | `5173` | React/Vite frontend for the incident room.    |
| Kong Proxy        | `8000` | Entry point for proxied application traffic.  |
| Kong Admin API    | `8001` | Kong administration API used by Gong.         |
| Prometheus        | `9090` | Kong metrics collection and querying.         |
| Gong PostgreSQL   | `5433` | Gong database.                                |
| Kong PostgreSQL   | `5432` | Kong database.                                |

## Main Features

- Admin authentication with JWT.
- Admin account management and deactivation.
- Kong management: services, routes, consumers, API keys, and plugins.
- Incident management: creation, listing, history, and statuses.
- Incident Room: presence, chat, acknowledge, resolve, and realtime updates through Socket.IO.
- Monitoring: alert rules, manual checks, and incident generation from thresholds.
- Metrics: Prometheus collection, backend cache, realtime SSE, and live dashboard charts.
- Webhooks: configuration, delivery tracking, and Slack/Discord/generic formatting.
- Messenger: inbound event ingestion and browsing.
- GraphQL: unified API facade to simplify frontend development.

## Interfaces

After starting the backend:

| Interface         | URL                                 |
| ----------------- | ----------------------------------- |
| Unified dashboard | `http://localhost:3000/dashboard`   |
| Apollo GraphQL    | `http://localhost:3000/graphql`     |
| Metrics SSE       | `http://localhost:3000/metrics/sse` |
| REST incidents    | `http://localhost:3000/incidents`   |
| Incident Room dev | `http://localhost:5173`             |

The unified dashboard uses GraphQL for standard data loading and mutations. Live metrics use SSE. The incident room uses Socket.IO.

## Local Setup

Requirements:

- Docker and Docker Compose.
- Node.js and npm.

Start the infrastructure:

```powershell
docker compose up -d
```

Start the backend:

```powershell
cd gong-core
npm install
npm run start:dev
```

Open the dashboard:

```text
http://localhost:3000/dashboard
```

Start the incident room in development mode:

```powershell
cd incident-room
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

The dashboard's "Open Incident Room" button first tries to open an embedded build under `/incident-room/`, then falls back to `localhost:5173` when the embedded build is not available.

## Configuration

The backend reads its configuration from `gong-core/.env`.

Important variables:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=gong
DB_PASSWORD=gong
DB_DATABASE=sentinel_gateway

SENTINEL_CORS_ORIGIN=http://localhost:5173
PROMETHEUS_URL=http://localhost:9090
JWT_SECRET=change_me
CEO_SECRET=change_this_ceo_secret
```

The default values are intended for local development. Secrets must be replaced before using the system outside a local environment.

## GraphQL

GraphQL is exposed at:

```text
POST /graphql
```

Apollo Sandbox is available in the browser:

```text
http://localhost:3000/graphql
```

The frontend sends the JWT token with:

```http
Authorization: Bearer <accessToken>
```

GraphQL acts as a unified facade for:

- auth and admins;
- gateway services/routes/consumers;
- incidents;
- monitoring;
- metrics;
- webhooks;
- messenger.

## Realtime

The project uses two realtime mechanisms:

| Mechanism                  | Purpose                                            |
| -------------------------- | -------------------------------------------------- |
| SSE `/metrics/sse`         | Prometheus metrics stream and health changes.      |
| Socket.IO `/incident-room` | Incident collaboration and realtime incident feed. |

SSE metrics feed the dashboard cards and live charts. Socket.IO lets the Incident Room receive new incidents without a refresh button.

## Tests And Validation

Backend:

```powershell
cd gong-core
npm test
npx tsc --noEmit -p tsconfig.build.json
```

Useful focused tests:

```powershell
npm test -- gong-graphql.resolver --runInBand
npm test -- prometheus.service metrics.service --runInBand
```

Incident Room frontend:

```powershell
cd incident-room
npm run build
```

Static dashboard:

```powershell
cd gong-core
node --check public\app.js
```

## Module Documentation

Each backend module has dedicated documentation:

- `gong-core/src/auth/README.md`
- `gong-core/src/users/README.md`
- `gong-core/src/gateway/README.md`
- `gong-core/src/incidents/README.md`
- `gong-core/src/monitoring/README.md`
- `gong-core/src/metrics/README.md`
- `gong-core/src/webhooks/README.md`
- `gong-core/src/messenger/README.md`

Additional notes are available under `gong-core/docs/`.

## Development Notes

- `gong-core` is the central application and should remain the owner of business logic.
- GraphQL simplifies frontend consumption, but it does not replace realtime streams.
- Backend events stay decoupled from frontend messages.
- Kong receives real traffic on `localhost:8000`.
- Gong administers Kong through `localhost:8001`.
- Prometheus collects Kong metrics from `/metrics`.
