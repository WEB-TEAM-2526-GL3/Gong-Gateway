# Gong Gateway Architecture

This document describes the architecture of Gong Gateway with Mermaid diagrams and implementation-level notes.

Gong Gateway is composed of:

- `gong-core`: the NestJS backend, static unified dashboard, GraphQL API, REST endpoints, SSE metrics stream, and Socket.IO incident room gateway.
- `incident-room`: a React/Vite frontend dedicated to realtime incident collaboration.
- Infrastructure services: Kong, Prometheus, PostgreSQL, and local test providers.

## 1. System Context

```mermaid
flowchart LR
  Operator[Admin / Operator]
  ExternalUser[API Consumer]
  Messenger[Messenger Platform]
  WebhookTarget[Slack / Discord / Generic Webhook]

  subgraph Browser
    Dashboard[Unified Dashboard]
    IncidentRoom[Incident Room Frontend]
    Apollo[Apollo Sandbox]
  end

  subgraph Gong
    Core[Gong Core - NestJS]
    GraphQL[GraphQL Facade]
    REST[REST Controllers]
    SSE[SSE Metrics Stream]
    WS[Socket.IO Incident Gateway]
  end

  subgraph Infrastructure
    KongProxy[Kong Proxy :8000]
    KongAdmin[Kong Admin API :8001]
    Prometheus[Prometheus :9090]
    SentinelDB[(Gong PostgreSQL :5433)]
    KongDB[(Kong PostgreSQL :5432)]
  end

  Operator --> Dashboard
  Operator --> IncidentRoom
  Operator --> Apollo
  ExternalUser --> KongProxy
  Messenger --> REST

  Dashboard --> GraphQL
  Dashboard --> SSE
  IncidentRoom --> REST
  IncidentRoom --> WS
  Apollo --> GraphQL

  GraphQL --> Core
  REST --> Core
  SSE --> Core
  WS --> Core

  Core --> SentinelDB
  Core --> KongAdmin
  Core --> Prometheus
  Core --> WebhookTarget

  KongProxy --> KongDB
  KongAdmin --> KongDB
  Prometheus --> KongAdmin
```

## 2. Runtime Ports

```mermaid
flowchart TB
  subgraph Host[Local Machine]
    SentinelCore["gong-core\nlocalhost:3000"]
    IncidentRoomDev["incident-room dev\nlocalhost:5173"]
    KongProxy["Kong Proxy\nlocalhost:8000"]
    KongAdmin["Kong Admin API\nlocalhost:8001"]
    Prometheus["Prometheus\nlocalhost:9090"]
    SentinelPostgres["Gong DB\nlocalhost:5433"]
    KongPostgres["Kong DB\nlocalhost:5432"]
  end

  SentinelCore --> SentinelPostgres
  SentinelCore --> KongAdmin
  SentinelCore --> Prometheus
  IncidentRoomDev --> SentinelCore
  Prometheus --> KongAdmin
  KongProxy --> KongPostgres
  KongAdmin --> KongPostgres
```

## 3. Application Containers

```mermaid
flowchart LR
  subgraph Frontends
    StaticDashboard["gong-core/public\nVanilla JS Dashboard"]
    ReactIncidentRoom["incident-room\nReact + Vite"]
  end

  subgraph Backend["gong-core NestJS"]
    AppModule[AppModule]
    GraphQLModule[SentinelGraphqlModule]
    AuthModule[AuthModule]
    UsersModule[UsersModule]
    GatewayModule[GatewayModule]
    IncidentsModule[IncidentsModule]
    MonitoringModule[MonitoringModule]
    MetricsModule[MetricsModule]
    WebhooksModule[WebhooksModule]
    MessengerModule[MessengerModule]
  end

  subgraph External
    Kong[Kong]
    Prom[Prometheus]
    DB[(PostgreSQL)]
    WebhookReceivers[Webhook Receivers]
    Meta[Messenger / Meta Webhook]
  end

  StaticDashboard --> GraphQLModule
  StaticDashboard --> MetricsModule
  ReactIncidentRoom --> IncidentsModule

  AppModule --> GraphQLModule
  AppModule --> AuthModule
  AppModule --> UsersModule
  AppModule --> GatewayModule
  AppModule --> IncidentsModule
  AppModule --> MonitoringModule
  AppModule --> MetricsModule
  AppModule --> WebhooksModule

  GraphQLModule --> AuthModule
  GraphQLModule --> UsersModule
  GraphQLModule --> GatewayModule
  GraphQLModule --> IncidentsModule
  GraphQLModule --> MonitoringModule
  GraphQLModule --> MetricsModule
  GraphQLModule --> WebhooksModule
  GraphQLModule --> MessengerModule

  GatewayModule --> Kong
  MetricsModule --> Prom
  MonitoringModule --> Prom
  AuthModule --> DB
  UsersModule --> DB
  IncidentsModule --> DB
  MonitoringModule --> DB
  WebhooksModule --> WebhookReceivers
  MessengerModule --> Meta
```

## 4. Backend Module Responsibilities

```mermaid
flowchart TB
  App[AppModule]
  EventBus[EventEmitterModule]

  App --> Auth
  App --> Users
  App --> Gateway
  App --> Incidents
  App --> Monitoring
  App --> Metrics
  App --> Webhooks
  App --> GraphQL
  App --> EventBus

  Auth[AuthModule\nlogin, register, JWT, CEO secret]
  Users[UsersModule\nadmin persistence and status]
  Gateway[GatewayModule\nKong services, routes, consumers, plugins]
  Incidents[IncidentsModule\nincident state, logs, Socket.IO room]
  Monitoring[MonitoringModule\nrules, checks, threshold events]
  Metrics[MetricsModule\nPrometheus polling, cache, SSE]
  Webhooks[WebhooksModule\nwebhook configs, deliveries, formatters]
  Messenger[MessengerModule\nMeta webhook ingestion and event history]
  GraphQL[SentinelGraphqlModule\nfrontend facade]

  GraphQL --> Auth
  GraphQL --> Users
  GraphQL --> Gateway
  GraphQL --> Incidents
  GraphQL --> Monitoring
  GraphQL --> Metrics
  GraphQL --> Webhooks
  GraphQL --> Messenger

  Monitoring --> EventBus
  Metrics --> EventBus
  Incidents --> EventBus
  Webhooks --> EventBus
```

### Module Summary

| Module       | Main owner of                       | Main inputs                                               | Main outputs                                           |
| ------------ | ----------------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| `auth`       | Authentication and JWT sessions     | `/auth/login`, `/auth/register`, GraphQL login/register   | JWT access token, authenticated user                   |
| `users`      | Admin user records                  | Auth registration, admin queries                          | User data and account status                           |
| `gateway`    | Kong administration                 | REST/GraphQL gateway actions                              | Kong services, routes, consumers, plugins              |
| `incidents`  | Incident lifecycle and logs         | REST/GraphQL create, Socket.IO actions, monitoring events | Incident snapshots, Socket.IO messages, backend events |
| `monitoring` | Alert rules and checks              | REST/GraphQL rule management, manual checks               | Check reports, threshold events                        |
| `metrics`    | Prometheus metrics cache and stream | Prometheus queries and polling                            | `metrics.updated`, SSE stream, health state            |
| `webhooks`   | Outbound webhook delivery           | Webhook configs, backend events, manual emit              | Delivery attempts and notifications                    |
| `messenger`  | Messenger inbound events            | Meta webhook GET/POST                                     | Stored inbound events and recipient summaries          |
| `graphql`    | Unified frontend facade             | GraphQL queries/mutations                                 | Aggregated typed API responses                         |

## 5. API Surfaces

```mermaid
flowchart LR
  Frontend[Unified Dashboard]
  IncidentUI[Incident Room UI]
  Meta[Messenger Platform]
  TestClient[HTTP Test Client]

  subgraph SentinelCore
    GraphQL["/graphql\nApollo GraphQL"]
    AuthRest["/auth/*"]
    GatewayRest["/gateway/*"]
    IncidentRest["/incidents/*"]
    MonitoringRest["/monitoring/*"]
    MetricsSSE["/metrics/sse"]
    WebhookRest["/webhooks/*\n/webhook-deliveries/*"]
    MessengerRest["/messenger/*"]
    IncidentWS["Socket.IO /incident-room"]
  end

  Frontend --> GraphQL
  Frontend --> MetricsSSE
  IncidentUI --> IncidentRest
  IncidentUI --> IncidentWS
  Meta --> MessengerRest
  TestClient --> AuthRest
  TestClient --> GatewayRest
  TestClient --> IncidentRest
  TestClient --> MonitoringRest
  TestClient --> WebhookRest
```

## 6. GraphQL Consumption Flow

The unified dashboard uses GraphQL for most reads and mutations. It stores the JWT in `localStorage` and sends it as a Bearer token.

```mermaid
sequenceDiagram
  actor Admin
  participant Dashboard as Unified Dashboard
  participant GraphQL as /graphql
  participant Guard as GqlJwtAuthGuard
  participant Resolver as SentinelGraphqlResolver
  participant Service as Domain Service
  participant DB as PostgreSQL / Kong / Prometheus

  Admin->>Dashboard: Open dashboard
  Dashboard->>GraphQL: mutation login(input)
  GraphQL->>Resolver: login
  Resolver->>Service: AuthService.login
  Service-->>Resolver: accessToken + user
  Resolver-->>Dashboard: AuthPayload
  Dashboard->>Dashboard: Store JWT in localStorage

  Dashboard->>GraphQL: query dashboardOverview with Authorization header
  GraphQL->>Guard: Validate JWT
  Guard-->>GraphQL: Authenticated user
  GraphQL->>Resolver: dashboardOverview
  Resolver->>Service: Load incidents, monitoring, gateway services
  Service->>DB: Read domain data
  DB-->>Service: Data
  Service-->>Resolver: Domain models
  Resolver-->>Dashboard: GraphQL DTOs
  Dashboard->>Dashboard: Render view
```

## 7. Metrics Flow

Metrics use two paths:

- GraphQL returns the latest cached metrics when the dashboard loads the metrics page.
- SSE pushes live metric events to update cards and charts in realtime.

```mermaid
sequenceDiagram
  participant Prom as Prometheus
  participant PromSvc as PrometheusService
  participant MetricsSvc as MetricsService
  participant EventBus as EventEmitter2
  participant MetricsCtrl as MetricsController
  participant Dashboard as Unified Dashboard

  loop every polling interval
    MetricsSvc->>PromSvc: queryGatewayMetrics(scope, "5m")
    PromSvc->>Prom: PromQL queries
    Prom-->>PromSvc: total requests, rate, status codes, latency
    PromSvc-->>MetricsSvc: GatewayMetrics
    MetricsSvc->>MetricsSvc: Cache metrics and update health state
    MetricsSvc->>EventBus: emit metrics.updated
  end

  Dashboard->>MetricsCtrl: GET /metrics/sse
  MetricsCtrl->>EventBus: Subscribe to metrics.updated
  EventBus-->>MetricsCtrl: MetricsUpdatedEvent
  MetricsCtrl-->>Dashboard: SSE event metrics.updated
  Dashboard->>Dashboard: Update cards and live charts
```

## 8. Incident Room Flow

The Incident Room has two realtime scopes:

- Global incident feed: all connected clients can receive newly created incidents.
- Per-incident room: admins who joined a specific incident receive messages, presence, ack, and resolve updates.

```mermaid
sequenceDiagram
  actor AdminA
  actor AdminB
  participant UIA as Incident Room UI A
  participant UIB as Incident Room UI B
  participant WS as IncidentRoomGateway
  participant IncSvc as IncidentsService
  participant DB as PostgreSQL
  participant EventBus as EventEmitter2

  AdminA->>UIA: Open incident room
  UIA->>WS: connect /incident-room
  UIA->>WS: subscribeIncidentFeed
  WS->>UIA: incidentFeedSubscribed

  AdminB->>UIB: Create incident
  UIB->>IncSvc: POST /incidents
  IncSvc->>DB: Insert incident + CREATED log
  DB-->>IncSvc: Saved data
  IncSvc->>EventBus: emit incident.created
  EventBus-->>WS: incident.created
  WS->>IncSvc: getIncidentSnapshot(id)
  IncSvc-->>WS: Snapshot
  WS-->>UIA: incidentCreated
  WS-->>UIB: incidentCreated

  AdminA->>UIA: Join incident
  UIA->>WS: joinIncident
  WS->>IncSvc: getIncidentSnapshot(id)
  IncSvc-->>WS: Snapshot + logs
  WS-->>UIA: incidentJoined
  WS-->>UIA: presenceUpdated
```

## 9. Incident State Machine

```mermaid
stateDiagram-v2
  [*] --> OPEN: createIncident
  OPEN --> ACKNOWLEDGED: ackIncident
  OPEN --> RESOLVED: resolveIncident
  ACKNOWLEDGED --> RESOLVED: resolveIncident
  RESOLVED --> [*]

  note right of OPEN
    Incident is active and not owned yet.
  end note

  note right of ACKNOWLEDGED
    An admin has taken ownership.
  end note

  note right of RESOLVED
    Incident is closed and resolvedAt is set.
  end note
```

## 10. Monitoring To Incident Flow

Monitoring rules can generate incidents through backend events. The monitoring module does not directly talk to webhooks or frontend clients.

```mermaid
sequenceDiagram
  participant Admin as Admin / Dashboard
  participant Monitoring as MonitoringService
  participant Prometheus as Prometheus
  participant EventBus as EventEmitter2
  participant Incidents as IncidentsService
  participant Webhooks as IncidentCreatedListener
  participant WebhookSvc as WebhooksService
  participant Target as Slack / Discord / Generic URL

  Admin->>Monitoring: runManualCheck()
  Monitoring->>Prometheus: Query rule metric
  Prometheus-->>Monitoring: Metric value
  Monitoring->>Monitoring: Compare value with threshold and cooldown

  alt threshold exceeded
    Monitoring->>EventBus: emit monitoring.threshold.exceeded
    EventBus-->>Incidents: handleThresholdExceeded
    Incidents->>Incidents: createIncident()
    Incidents->>EventBus: emit incident.created
    EventBus-->>Webhooks: handleIncidentCreated
    Webhooks->>WebhookSvc: emit INCIDENT_CREATED
    WebhookSvc->>Target: POST formatted notification
  else threshold not exceeded
    Monitoring-->>Admin: CheckResult(triggered = false)
  end
```

## 11. Webhook Delivery Flow

```mermaid
flowchart LR
  Event[Backend Event or Manual Emit]
  WebhooksService[WebhooksService]
  Repository[WebhooksRepository]
  FormatterFactory[WebhookPayloadFormatterFactory]
  Delivery[Webhook Delivery Record]
  Http[HTTP POST]
  Target[Slack / Discord / Generic Receiver]

  Event --> WebhooksService
  WebhooksService --> Repository
  Repository --> WebhooksService
  WebhooksService --> FormatterFactory
  FormatterFactory --> WebhooksService
  WebhooksService --> Delivery
  WebhooksService --> Http
  Http --> Target
  Target --> WebhooksService
  WebhooksService --> Delivery
```

## 12. Messenger Inbound Flow

```mermaid
sequenceDiagram
  participant Meta as Messenger / Meta
  participant Ctrl as MessengerWebhookController
  participant Service as MessengerWebhookService
  participant Repo as MessengerEventsRepository
  participant API as GraphQL / REST Readers

  Meta->>Ctrl: GET /messenger/webhook verification
  Ctrl-->>Meta: challenge response

  Meta->>Ctrl: POST /messenger/webhook
  Ctrl->>Service: handleWebhookPayload
  Service->>Repo: Persist public inbound event
  Repo-->>Service: Stored event
  Service-->>Ctrl: ACK

  API->>Service: listEvents / listRecipients
  Service->>Repo: Query stored events
  Repo-->>Service: Events and recipient summary
  Service-->>API: Public response shape
```

## 13. Data Model

Gong stores its own operational data in PostgreSQL. Kong configuration is mainly managed through Kong Admin API and stored by Kong in its own database.

```mermaid
erDiagram
  USERS {
    uuid id PK
    string email UK
    string full_name
    string password_hash
    enum role
    enum status
    timestamp created_at
    timestamp updated_at
  }

  INCIDENTS {
    uuid id PK
    uuid service_id
    uuid provider_id
    enum severity
    text reason
    enum status
    timestamp created_at
    timestamp updated_at
    timestamp resolved_at
  }

  INCIDENT_LOGS {
    int id PK
    uuid incident_id FK
    string admin_id
    string admin_name
    enum action
    jsonb details
    timestamp created_at
  }

  MONITORING_RULES {
    uuid id PK
    string name UK
    string service_name
    uuid provider_id
    enum type
    decimal error_rate_threshold
    int latency_threshold_ms
    string metric_window
    int cooldown_minutes
    boolean is_active
    enum severity
    timestamp last_triggered_at
    timestamp created_at
    timestamp updated_at
  }

  INCIDENTS ||--o{ INCIDENT_LOGS : has
```

## 14. Backend Events vs Frontend Messages

The project keeps a clear boundary between internal backend events and frontend transport messages.

```mermaid
flowchart LR
  subgraph BackendEvents[Backend EventEmitter events]
    ThresholdExceeded["monitoring.threshold.exceeded"]
    IncidentCreated["incident.created"]
    MetricsUpdated["metrics.updated"]
    MetricsFailed["metrics.poll.failed"]
    HealthChanged["health.changed"]
  end

  subgraph TransportMessages[Frontend transport messages]
    SseMetrics["SSE: metrics.updated"]
    SseHealth["SSE: health.changed"]
    WsIncidentCreated["Socket.IO: incidentCreated"]
    WsIncidentUpdated["Socket.IO: incidentUpdated"]
    WsPresence["Socket.IO: presenceUpdated"]
    WsMessage["Socket.IO: incidentMessage"]
  end

  MetricsUpdated --> SseMetrics
  HealthChanged --> SseHealth
  IncidentCreated --> WsIncidentCreated
  ThresholdExceeded --> IncidentCreated
```

### Important Rule

Domain services should not own frontend sockets or browser-specific behavior.

- `IncidentsService` owns incident business logic and database writes.
- `MetricsService` owns metrics polling, cache, and backend metric events.
- `IncidentRoomGateway` owns Socket.IO connections, rooms, and emitted socket messages.
- `MetricsController` owns the SSE stream boundary.
- `SentinelGraphqlResolver` owns the GraphQL facade and maps domain objects to GraphQL types.

## 15. Request Ownership

```mermaid
flowchart TB
  Request[Incoming request or event]

  Request --> AuthBoundary{Boundary}

  AuthBoundary -->|GraphQL| Resolver[SentinelGraphqlResolver]
  AuthBoundary -->|REST| Controller[Nest Controller]
  AuthBoundary -->|SSE| MetricsController[MetricsController]
  AuthBoundary -->|Socket.IO| Gateway[IncidentRoomGateway]
  AuthBoundary -->|Internal event| Listener[Event Listener]

  Resolver --> DomainService[Domain Service]
  Controller --> DomainService
  Gateway --> DomainService
  Listener --> DomainService

  DomainService --> Repository[Repository / TypeORM / External Client]
  Repository --> Store[(Database / Kong / Prometheus / External API)]
```

## 16. External Dependencies

| Dependency                     | Used by                                  | Purpose                                                          |
| ------------------------------ | ---------------------------------------- | ---------------------------------------------------------------- |
| Kong Admin API                 | `GatewayService`                         | Manage services, routes, consumers, plugins, and credentials.    |
| Kong Proxy                     | Runtime traffic                          | Receives real API traffic from consumers.                        |
| Prometheus                     | `PrometheusService`, `MonitoringService` | Query gateway metrics and rule values.                           |
| PostgreSQL                     | TypeORM modules                          | Store users, incidents, logs, monitoring rules, and local state. |
| Slack / Discord / Generic URLs | `WebhooksService`                        | Send incident and admin notifications.                           |
| Messenger / Meta               | `MessengerWebhookController`             | Receive inbound social messages and postbacks.                   |

## 17. Frontend Consumption Pattern

```mermaid
flowchart LR
  Dashboard[Unified Dashboard]
  GraphQLFetch["fetch('/graphql')"]
  LocalStorage["localStorage sentinel_token"]
  SSE["EventSource('/metrics/sse')"]
  Render[DOM rendering]

  Dashboard --> GraphQLFetch
  Dashboard --> SSE
  GraphQLFetch --> LocalStorage
  GraphQLFetch --> Render
  SSE --> Render
```

The unified dashboard is intentionally simple:

- no frontend build step for `gong-core/public`;
- GraphQL strings are declared in `public/app.js`;
- `fetch('/graphql')` handles queries and mutations;
- `EventSource('/metrics/sse')` handles live metrics;
- in-memory state drives rendering.

The dedicated incident room is separate because it has a more interactive collaboration model:

- React state;
- Socket.IO connection to `/incident-room`;
- REST for initial incident list/detail loading;
- Socket.IO for feed updates, presence, chat, acknowledge, and resolve.

## 18. Extension Points

Good places to extend the system:

| Need                              | Recommended place                                                        |
| --------------------------------- | ------------------------------------------------------------------------ |
| Add a new dashboard read model    | Add a GraphQL query in `SentinelGraphqlResolver`.                        |
| Add a new domain action           | Add service method first, then expose via REST/GraphQL/socket if needed. |
| Add a new webhook provider        | Add formatter under `webhooks/formatters`.                               |
| Add a new monitoring rule type    | Extend `MonitoringRuleType` and `MonitoringService`.                     |
| Add a new realtime browser stream | Emit backend event first, then bridge it in a controller/gateway.        |
| Add a new Messenger event shape   | Extend messenger models and repository mapping.                          |

## 19. Testing Strategy

```mermaid
flowchart LR
  Unit[Unit tests]
  ResolverTests[GraphQL resolver tests]
  MetricsTests[Metrics and Prometheus tests]
  BuildChecks[TypeScript build checks]
  FrontendChecks[Frontend syntax/build checks]

  Unit --> ResolverTests
  Unit --> MetricsTests
  ResolverTests --> BuildChecks
  MetricsTests --> BuildChecks
  FrontendChecks --> BuildChecks
```

Useful validation commands:

```powershell
cd gong-core
npm test
npx tsc --noEmit -p tsconfig.build.json
node --check public\app.js
```

```powershell
cd incident-room
npm run build
```

## 20. Architectural Principles

- Keep business logic inside services.
- Keep transport-specific behavior inside controllers, resolvers, gateways, or SSE controllers.
- Use backend events to decouple modules.
- Use GraphQL as a frontend facade, not as the domain model itself.
- Use SSE for one-way live metrics.
- Use Socket.IO for bidirectional collaboration.
- Keep Kong configuration ownership in the gateway module.
- Keep incident state independent from the incident room frontend.
- Keep metrics resilient to missing or non-finite Prometheus values.
