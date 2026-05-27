# Sentinel Gateway — Architecture & Handoff (Final Version)

**Status:** Locked. Do not modify core design, entity schema, event contracts, or lifecycle logic.
**Branch:** `feat/sentinel-core`

---

## 1. Project Context

### 1.1 What We Set Out to Build

Sentinel Gateway is a **control plane** that sits on top of Kong API Gateway. It was designed to solve three problems faced by organizations that consume third‑party APIs (especially LLMs):

1. **Observability:** No unified view of traffic, latency, errors, and usage across multiple API providers.
2. **Resilience:** No easy way to failover from a failing provider (e.g., OpenAI) to a backup (e.g., Gemini).
3. **Governance:** No way to set and enforce limits (request caps, token caps) per internal consumer of those APIs.

**Original use cases we planned:**
- Register API providers (OpenAI, Gemini, Stripe) and store their credentials securely.
- Register internal consumers ("Clients" — e.g., ChatService, SummaryService) that use those providers.
- Link Clients to Providers with a primary/fallback model.
- Monitor traffic in real time via dashboards (SSE).
- Detect provider health issues and trigger failover automatically (or manually).
- Enforce request limits and token limits.
- Send notifications (webhooks) when incidents occur.
- Provide historical analytics via GraphQL.

**What we will NOT deliver in MVP (due to time):**
- Per‑client AI token attribution (blocked by Kong OSS — see §3.1).
- Cost tracking / billing / budgets.
- GraphQL analytics (team may add later; REST history endpoints exist).
- Full incident state machine (only append‑only log exists).
- Webhook/notification delivery (stub exists).
- Automatic health re‑probing or limit reset (manual admin action required).

---

### 1.2 The Tool: Kong API Gateway

**Kong** is a cloud‑native API gateway built on OpenResty (Nginx + Lua). It acts as a reverse proxy: clients call Kong, Kong routes to upstream APIs. Kong provides:

- **Core entities:** Services (abstract backend), Routes (entry paths), Upstreams (load‑balanced backends), Consumers (caller identity).
- **Plugins:** Lua/Go modules that hook into the request lifecycle — authentication, rate limiting, request transformation, logging, monitoring.
- **Admin API (REST):** CRUD for all entities and plugin configuration.
- **Declarative config (decK):** YAML → Kong sync.
- **Prometheus plugin:** Exposes `/metrics` endpoint on the Admin API for scraping.

**Why we chose Kong:** It handles the hard proxy work (TLS, routing, retries), has a large plugin ecosystem, and is widely used. The plan was to leverage its built‑in plugins for auth injection, rate limiting, and monitoring, so we could focus on the control plane logic.

---

## 2. Nomenclature — Sentinel Concepts vs Kong Concepts

To avoid confusion, we use **Sentinel‑specific terms** that map to Kong entities as follows:

| Sentinel Term | Meaning | Kong Entity | Example |
|---------------|---------|-------------|---------|
| **Provider** | A third‑party API (OpenAI, Gemini, Stripe) | Kong Service + Plugin(s) | Provider `openai-gpt4o` → Kong Service named `openai-gpt4o-svc` |
| **Client** | An internal consumer of Providers (e.g., ChatService) | No direct Kong entity — represented by a Route | Client `chat-service` → Kong Route `/{sanitised-client-name}` |
| **Client‑Provider Link** | A specific pairing of a Client with a Provider, with a role (primary/fallback) | Kong Route (the Route points to the Provider's Kong Service) | Link (ChatService → OpenAI) → Route `/chat-service` on Service `openai-gpt4o-svc` |
| **Primary link** | The currently active link for a Client | The Kong Route's `service.id` | Route points to `openai-gpt4o-svc` |
| **Secondary link** | An alternative link eligible for failover | Another Kong Service + Route (pre‑created but not routed to) | Service `gemini-pro-svc`, Route `/chat-service` (on standby) |
| **Bad service** | A special Kong Service that always returns an error (429 or 503) | Kong Service pointing to a Docker container that returns the error | `limit-exceeded-svc` → container `limit-exceeded:9429` returns 429, `provider-dead-svc` → container `provider-dead:9503` returns 503 |
**Kong Consumers are not used** in our MVP. Auth is handled by the Sentinel backend (JWT). The "who is calling" question is answered by which Client owns the Route.

---

## 3. Key Findings & Limitations

### 3.1 Kong OSS AI Metrics Limitation

Kong 3.9.1 OSS has an **AI Proxy plugin** that translates requests to different LLM providers and returns token counts. The Prometheus plugin can expose AI metrics with `ai_metrics: true`. These metrics include `ai_llm_tokens_total` and `ai_llm_cost_total`.

**Critical limitation:** AI metrics do **not** carry `service` or `route` labels. They only carry `ai_provider` and `ai_model`. This means we **cannot** attribute token usage to a specific Client via Prometheus alone. We can only get global token counts per provider+model.

**Our compromise:** We expose global AI token counts on the dashboard (per provider). We do **not** show per‑Client AI token usage. We document this limitation and explain it in the demo.

### 3.2 Health Checks

Kong has built‑in health checks only for **Upstreams** (groups of backend servers). Since we chose to use simple Kong Services (with a direct `host` field, no Upstreams) to reduce complexity, we cannot use Kong's health checks.

**Our solution:** Empirical health monitoring. `HealthService` listens to `metrics.updated` events (from Prometheus). If a provider returns 5xx or 429 errors for 10 consecutive 15‑second polls, it is marked **unhealthy**. Recovery requires manual admin reactivation of the affected link.

### 3.3 Plugin Configuration

Plugin configuration via Kong Admin API is **all‑or‑nothing**: `PATCH /plugins/{id}` replaces the entire `config` object. Partial updates are not supported. This makes programmatic configuration fragile.

**Our solution:** The adapter always reads the desired state from our database (entities), then generates the full plugin config and pushes it to Kong. If Kong fails, we rollback the database change. This DB‑first pattern is used in all service methods that touch Kong.

### 3.4 Enterprise Features (Not Available to Us)

- Per‑consumer AI metrics (`consumer` label on AI metrics) — Enterprise only.
- AI Proxy Advanced (multi‑model load balancing) — Enterprise only.
- Kong Workspaces (multi‑tenant isolation) — Enterprise only.
- Kong Manager GUI (full version) — available in OSS but we use Admin API directly.

**All decisions below were made with these limitations in mind.**

---

## 4. Design Decisions & Compromises (Authoritative)

### 4.1 Provider = Kong Service (1:1)
Each Provider entity maps to exactly one Kong Service. Service name = `{sanitised-provider-name}` for generic, `{sanitised-name}-{sanitised-model}` for AI. This is non‑negotiable because:
- It gives us clean Prometheus labels (`service="openai-gpt4o-svc"`).
- It isolates configuration (each Provider has its own plugins).
- It makes route switching simple (change the Route's `service.id`).

**API Key Ownership:**
The API key is stored on the Provider entity (`encryptedApiKey`). For different keys, **create separate Provider entities**. This works because each Client gets its own Provider Service, so in practice, different Clients using the "same" Provider actually have separate Kong Services with separate plugin configs.

### 4.2 Client‑Provider Link = Kong Route (1:1)
Each active Link (Client ↔ Provider) gets a dedicated Kong Route. Route path = `/{sanitised-client-name}`. Route points to the Provider's Kong Service. This means:
- A Client with 3 Providers has 3 Routes (one per link), but only the primary link's Route is "active" (the one the Client actually calls).
- Switching primary = updating the Route's `service.id` to point to the new Provider's Service.
- When a Client is blocked (no active links), the Route points to a **bad service** (429 or 503).

**One Primary per Client:**
Exactly one link with `kind='primary'` per active Client. The frontend enforces this in the UI; the backend rejects duplicate primary creation (`LinkService.linkClientToProvider` throws `ConflictException`).

### 4.3 API Key Lives on Provider
Normally, an API key should be per‑Client‑Provider link (different Clients may have different keys for the same Provider). For simplicity, we store the key on the Provider entity. This works because each Client gets its own Provider Service (the 1:1 lie), so in practice, different Clients using the "same" Provider actually have separate Kong Services with separate plugin configs. The key can be different per Client if the admin creates separate Provider entities.

### 4.4 Health = Empirical Error Counting
No active health probes. `HealthService` counts consecutive 5xx/429 errors from `metrics.updated` events. Threshold = 10. When threshold reached:
- Provider marked unhealthy.
- `health.changed` event emitted.
- `IncidentService` handles failover for all affected Clients.

Recovery: Admin must manually reactivate the link (`activateLink`), then manually switch (`selectLink`). There is no automatic re‑probing or self‑healing.

**`activateLink` Semantics:**
It only changes `kind` from `secondary-inactive` to `secondary-active` and clears `incidentId`. It **does not** restore traffic. Admin must separately call `selectLink` to switch traffic back.

### 4.5 Failover = Manual or Rule‑Based
A `FailoverRule` (per Client) determines whether automatic failover is allowed (`onLimit`, `onDead`). If allowed, `LinkService.handleLinkFailure` promotes the **first** `secondary-active` link to primary. The "first" is determined by **creation order** (`ORDER BY created_at ASC` in SQL). If no secondary exists, the Client becomes blocked (route → bad service). Admin must later reactivate and switch.

### 4.6 Limits = Cumulative Caps, Not Rates
`RequestLimit` and `TokenLimit` are cumulative counters (not per‑second rates). When exceeded, the link is deactivated. No automatic reset. Admin must archive the old limit and create a new one (or reactivate the link).

**TokenLimit Scope:**
`TokenLimit` is **global per AI Provider**. The `TokenLimit` table has `provider_id` (FK to providers), no `client_id`. When exceeded, `IncidentService` finds all primary links using that provider and deactivates them.

### 4.7 No Cost Tracking
No cost fields on any entity. No per‑request billing. Deferred.

### 4.8 No Incident State Machine
Incidents are append‑only logs. No status transitions (OPEN → ACKNOWLEDGED → RESOLVED). The `Incident` entity records the reason, timestamp, and affected link.

---
---
## 5. Entity Model (Complete)

### 5.1 Provider

**Base table `providers`:**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| kind | `'llm'` or `'generic'` | discriminator |
| service_name_cached | text | unique, becomes Kong Service name |
| base_url | text | |
| auth_method | `'bearer'` / `'apiKey'` / `'query'` | |
| auth_header_name | text? | for bearer/apiKey |
| auth_param_name | text? | for query |
| encrypted_api_key | text | the secret |
| is_archived | boolean | soft delete |
| created_at | timestamp | |
| updated_at | timestamp | |

**Subtype `generic_providers` (1:1):** `id`, `provider_id` (FK), `name`.
**Subtype `ai_providers` (1:1):** `id`, `provider_id` (FK), `name`, `model_name`.

**Derivation of `service_name_cached`:**
- Generic: sanitise(`name`) → e.g. `"stripe-api"` → `stripe-api-svc`
- AI: sanitise(`name` + "-" + `model_name`) → e.g. `"openai"` + `"gpt-4o"` → `openai-gpt4o-svc`

**Invariants:**
- A Provider can be archived only if no active `ClientProviderLink` references it.
- `serviceNameCached` is unique across all Providers.

---

### 5.2 Client

**Table `clients`:**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | |
| team | text | |
| status | `'active'` / `'dead'` / `'limit'` / `'archived'` | |
| primary_link_id | uuid? | FK → client_provider_links.id |
| created_at | timestamp | |

**Invariants:**
- `status = 'active'` ↔ `primaryLinkId` is non‑null and points to a Link with `kind = 'primary'`.
- `status ∈ {'dead', 'limit'}` → `primaryLinkId` is null (route points to bad service).
- `status = 'archived'` → client soft‑deleted.

**Client Status Clarification:**
- `'active'`: Client has a primary link and is routing traffic normally.
- `'dead'`: Client has **no active links due to Provider health failure** (5xx/429 errors). Route points to `provider-dead-svc`.
- `'limit'`: Client has **no active links due to RequestLimit or TokenLimit being exceeded**. Route points to `limit-exceeded-svc`.
- The **type of limit** (request/token) or **health issue** is recorded in the `Incident` entity.

---

### 5.3 ClientProviderLink

**Table `client_provider_links`:**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| client_id | uuid | FK → clients.id |
| provider_id | uuid | FK → providers.id |
| kind | `'primary'` / `'secondary-active'` / `'secondary-inactive'` / `'archived'` | |
| incident_id | uuid? | FK → incidents.id, only when kind = 'secondary-inactive' |
| kong_service_name | text? | cached Kong service name |
| kong_route_name | text? | cached Kong route name |
| created_at | timestamp | |

**How `kind` works:**
- `'primary'`: the currently routed link. At most one per Client.
- `'secondary-active'`: healthy alternative, eligible for failover/switch.
- `'secondary-inactive'`: deactivated due to incident. Carries `incidentId`.
- `'archived'`: soft deleted.

**Invariants:**
- A Client with `status = 'active'` must have exactly one Link with `kind = 'primary'`.
- A Link with `kind ≠ 'secondary-active'` cannot be selected as primary.
- A Link with `kind = 'secondary-inactive'` must have `incidentId` set.

---
### 5.4 FailoverRule

**Table `failover_rules`:** `id`, `client_id` (unique), `on_limit` (bool), `on_dead` (bool).

**Invariants:** At most one rule per Client. Owned by `FailoverService`, not embedded in Client.

---
### 5.5 RequestLimit

**Table `request_limits`:** `id`, `client_id` (non‑null), `provider_id` (nullable), `max_requests` (int), `is_archived` (bool).

**Invariants:** Cumulative cap. When exceeded, link deactivated. Archived = soft deleted.

---
### 5.6 TokenLimit

**Table `token_limits`:** `id`, `provider_id` (must be AI provider), `max_tokens` (int), `is_archived` (bool).

**Invariants:** Global token cap per AI provider. When exceeded, all primary links using that provider are deactivated.

---
### 5.7 Incident

**Table `incidents`:** `id`, `reason` (`'dead'` / `'requestLimit'` / `'tokenLimit'`), `timestamp`, `link_id` (FK), `cached_client_id`, `cached_provider_id`, `limit_rule_id` (nullable).

**Invariants:**
- When `reason = 'dead'`, `limitRuleId` is null.
- When reason is a limit, `limitRuleId` points to the `RequestLimit` or `TokenLimit` that was exceeded.

---
---
## 6. Mapping to Kong (with Examples)

### 6.1 Provider Registration

**Example:** Admin registers OpenAI GPT‑4o.

1. `ProviderService.registerAIProvider({ name: "openai", modelName: "gpt-4o", baseUrl: "https://api.openai.com", authMethod: "bearer", authHeaderName: "Authorization", encryptedApiKey: "sk-abc" })`
2. Repository creates `Provider` entity + `AIProvider` sub‑entity. Derives `serviceNameCached = "openai-gpt4o-svc"`.
3. Adapter calls `POST /services` with `{ name: "openai-gpt4o-svc", url: "https://api.openai.com" }`.

**Bad Services Creation:**
Two Docker containers run alongside Kong:
- `limit-exceeded` (port 9429): Returns `429 Too Many Requests`.
- `provider-dead` (port 9503): Returns `503 Service Unavailable`.

`KongAdapterService.ensureBadServices()` registers them as Kong Services at startup (`onModuleInit`), pointing to `http://limit-exceeded:9429` and `http://provider-dead:9503`. When a Client is blocked, the route's `service.id` is updated to point to the appropriate bad service.

---
### 6.2 Linking Client to Provider

**Example:** Client `chat-service` linked to OpenAI as primary.

1. `LinkService.linkClientToProvider({ clientId: "...", providerId: "...", kind: "primary" })`
2. Repository creates `ClientProviderLink` with `kind = 'primary'`, `kongServiceName = "openai-gpt4o-svc"`, `kongRouteName = "chat-service-openai-gpt4o-svc-route"`.
3. Adapter:
   - Creates Route on the service: `POST /services/openai-gpt4o-svc/routes` with `{ name: "chat-service-openai-gpt4o-svc-route", paths: ["/chat-service"], strip_path: false }`.
   - Applies AI Proxy plugin: `POST /services/openai-gpt4o-svc/plugins` with `{ name: "ai-proxy", config: { route_type: "llm/v1/chat", auth: { param_name: "key", param_value: "sk-abc", param_location: "query" }, model: { provider: "openai", name: "gpt-4o" }, logging: { log_statistics: true } } }`.
4. Client's `primaryLinkId` set to the new link's ID. Client status = `'active'`.

**For a generic provider** (e.g., Stripe), the plugin would be `request-transformer` instead of `ai-proxy`, injecting an `Authorization` header.

---
### 6.3 Failover / Switching

**Example:** OpenAI becomes unhealthy. Client has Gemini as `secondary-active`.

1. `HealthService` detects 10 consecutive errors → emits `health.changed` with `healthy: false`.
2. `IncidentService` finds the primary link (ChatService → OpenAI), creates an Incident, calls `LinkService.handleLinkFailure(clientId, linkId, 'dead', incidentId)`.
3. `handleLinkFailure`:
   - Changes failed link to `kind = 'secondary-inactive'`, sets `incidentId`.
   - Calls `FailoverService.shouldFailover(clientId, 'dead')`.
   - If true, calls `linkRepo.findActiveSecondaries(clientId)` — returns links ordered by `created_at ASC`.
   - Promotes the first one to primary: changes its `kind` to `'primary'`, updates Client's `primaryLinkId`.
   - Calls `kongAdapter.updateRouteService(routeId, "gemini-pro-svc")` — the Kong Route now points to Gemini's service.
   - If no failover target exists: sets Client `status = 'dead'`, `primaryLinkId = null`, updates Route to point to `provider-dead-svc` (503).

---
---
## 7. Use Cases & Lifecycle (Step‑by‑Step)

### 7.1 Normal Operation
1. Admin creates Provider (→ Kong Service).
2. Admin creates Client.
3. Admin creates a primary Link (→ Kong Route + Plugin).
4. Admin optionally creates secondary Links (→ additional Routes + Plugins, on standby).
5. Client calls `https://kong:8443/{client-name}/...`. Kong routes to primary Provider.
6. Prometheus scrapes Kong every 15s.
7. `MetricsService` polls Prometheus, caches data, emits events.
8. Dashboard receives SSE updates.

---
### 7.2 Health Failure (Provider Dead)
1. `HealthService` accumulates errors → 10 consecutive → emits `health.changed` with `healthy: false`.
2. `IncidentService` iterates **all primary links** for that provider.
3. For each primary link:
   - Creates Incident (`reason: 'dead'`).
   - Calls `LinkService.handleLinkFailure(clientId, linkId, 'dead', incidentId)`.
4. `handleLinkFailure`:
   - Deactivates failed link (kind → `secondary-inactive`).
   - Emits `link.failed`.
   - If `FailoverService.shouldFailover(clientId, 'dead')` returns true:
     - Searches for first `secondary-active` link (oldest by `created_at`).
     - If found: promotes it to primary (`selectLink`), updates Kong Route.
     - If not found: Client status → `dead`, route → `provider-dead-svc` (503).

---
### 7.3 Limit Failure (Request Cap)
1. `LimitsService` compares request count to `RequestLimit`.
2. If exceeded: emits `limit.exceeded`.
3. `IncidentService` finds the primary link for that client+provider.
4. Creates Incident (`reason: 'requestLimit'`).
5. Calls `handleLinkFailure(clientId, linkId, 'limit', incidentId)`.
6. Same logic as health: try failover or block with `limit-exceeded-svc` (429).

---
### 7.4 Manual Switch
1. Admin calls `LinkService.selectLink(clientId, newLinkId)`.
2. Old primary → `secondary-active`.
3. New link → `primary`.
4. Client status stays `active`.
5. Kong Route updated to point to new primary's Service.
6. Event `link.primaryChanged` emitted.

---
### 7.5 Reactivation
1. Admin calls `LinkService.activateLink(linkId)`.
2. Link's kind changes from `secondary-inactive` to `secondary-active`. `incidentId` cleared.
3. This does **not** switch traffic. If Client is blocked, admin must manually call `selectLink`.

---
---
## 8. Service Inventory

| Service | Package | Role |
|---------|---------|------|
| `KongAdapterService` | `kong-adapter` | Thin HTTP wrapper around Kong Admin API. CRUD for Services, Routes, Plugins. `init()` creates bad services and global plugins. |
| `PrometheusService` | `metrics` | Thin HTTP wrapper around Prometheus API. Builds PromQL, executes instant and range queries. |
| `MetricsService` | `metrics` | Polls Prometheus every 15s, caches metrics per filter, emits `metrics.updated` and `ai.tokens.updated`. Implements `IMetricsRepository` (getLatest, getAiTokens, getRecentHistory). |
| `HealthService` | `metrics` | Listens to `metrics.updated`, tracks consecutive errors per provider, emits `health.changed`. |
| `LimitsService` | `metrics` | Listens to `metrics.updated` and `ai.tokens.updated`, checks stored limits, emits `limit.exceeded`. Also provides CRUD for limit rules. |
| `ProviderService` | `providers` | CRUD for Providers, secret rotation. DB‑first Kong sync. |
| `ClientService` | `clients` | CRUD for Clients. |
| `LinkService` | `links` | Linking, switching, failover handling, activation, client status queries. |
| `FailoverService` | `incidents` | Checks failover rules (yes/no). CRUD for rules. |
| `IncidentService` | `incidents` | Listens to health/limit events, logs incidents, triggers failover via LinkService. |
| `DashboardService` | `dashboard` | Manages SSE connections, sends snapshots and updates, provides REST history endpoints. |
| `CryptoService` | `common` | AES‑256‑GCM encrypt/decrypt for API keys. |
| `NotificationService` | `common` | Stub for future webhooks. |

---
---
## 9. Event Catalog

All events via `EventEmitter2` (synchronous). Do not change names or payloads.

| Event | Emitter | Key Payload | Consumers |
|-------|---------|-------------|-----------|
| `metrics.updated` | `MetricsService` | `{ clientId, providerId, metrics: KongMetrics, timestamp }` | `HealthService`, `LimitsService`, `DashboardService` |
| `ai.tokens.updated` | `MetricsService` | `{ providerId, modelName, prompt, completion, total }` | `LimitsService`, `DashboardService` |
| `health.changed` | `HealthService` | `{ providerId, healthy }` | `IncidentService`, `DashboardService` |
| `limit.exceeded` | `LimitsService` | `{ clientId, providerId, limitId, limitType, current, max }` | `IncidentService`, `DashboardService` |
| `incident.created` | `IncidentService` | `Incident` | `DashboardService` |
| `link.created` | `LinkService` | `{ linkId, clientId, providerId, kind }` | `DashboardService`, `MetricsService` |
| `link.archived` | `LinkService` | `{ linkId, clientId, providerId }` | `DashboardService`, `MetricsService` |
| `link.activated` | `LinkService` | `{ linkId, clientId, providerId }` | `DashboardService`, `MetricsService` |
| `link.primaryChanged` | `LinkService` | `{ clientId, oldLinkId, newLinkId, reason }` | `DashboardService` |
| `link.failed` | `LinkService` | `{ clientId, linkId, reason, incidentId }` | `DashboardService` |
| `provider.archived` | `ProviderService` | `{ providerId }` | `DashboardService`, `LinkService` |
| `provider.updated` | `ProviderService` | `{ providerId, changes }` | `DashboardService` |
| `provider.secretRotated` | `ProviderService` | `{ providerId }` | – |
| `client.archived` | `ClientService` | `{ clientId }` | `DashboardService`, `LinkService` |

---
---
## 10. Metrics & Prometheus

- `PrometheusService` translates `MetricsFilter` into PromQL label selectors:
  - Client+Provider: `{service="{client}-{provider}-svc"}`
  - Client only: `{service=~"{client}-.*"}`
  - Provider only: `{service=~".*-{provider}-svc"}`
  - Global: no filter.
- `MetricsService` polls every 15s. Caches:
  - Hot cache: latest `KongMetrics` per filter.
  - AI cache: latest `AiTokens` per provider+model.
  - Ring buffer (last 20) per filter for reconnect history.
- SSE snapshots read from cache. Updates via events. History REST uses `queryRange` directly.

**Staleness Behavior:**
If Prometheus is unreachable, `PrometheusService.querySingle()` returns 0. `MetricsService.pollAll()` catches the error, logs it, and **does not update the cache**. The last known values are retained indefinitely. The SSE snapshot includes the cached `timestamp` so the frontend can show staleness.

---
---
## 11. SSE Dashboard

**Endpoints:**
- `/dashboard/stream` — Overview (global metrics, all providers health, AI tokens)
- `/dashboard/stream/clients/:id` — Client detail
- `/dashboard/stream/providers/:id` — Provider detail
- `/dashboard/stream/providers` — Provider list

**Messages:**
- `snapshot` on connect (full state).
- `update` with `path` (dot‑notation) and `data` for incremental changes.
- `heartbeat` every 10s (for **dashboard staleness detection**).
- Queue per connection, drained every 2s.

**History REST:** `/dashboard/history/requests`, `/dashboard/history/errors`, `/dashboard/history/latency`, `/dashboard/history/tokens`. Accept `clientId`, `providerId`, `range`, `step`. Return `[{ timestamp, value }]`.

**Authentication:** History endpoints are protected by JWT (team's auth guard).

---
---
## 12. REST API Blueprint

See `docs/api-endpoints.md` for the full list. Controllers delegate to services. DTOs in module `dto/` folders.

---
---
## 13. Immediate TODOs

1. Build controllers per API blueprint.
2. Implement/integrate WebSocket chat room for incident collaboration.
3. Integrate User Login Logic
4. Fill `NotificationService` with actual webhook calls.
5. tests (integration...).
6. Build frontend consuming SSE and REST.
7. Demo script.


---
## 14. Final Authority

This document describes the final, locked architecture. Entity schemas, event contracts, service responsibilities, and lifecycle logic are **non‑negotiable**. Any proposed change must be justified as a bug fix, not a redesign. The system is coherent and ready for integration.

**Out of Scope for MVP (Do Not Build):**
- Per‑Client AI token attribution
- Cost tracking / billing / budgets
- Automatic health re‑probing or limit reset
- Incident state machine (acknowledge/resolve)
- GraphQL analytics
- Redis

