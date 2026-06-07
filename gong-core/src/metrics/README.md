# Metrics Module

## Purpose

`MetricsModule` reads gateway metrics from Prometheus, normalizes them into
application-level metric objects, caches the latest values, tracks simple
service health, and emits metric events for other modules.

It does not expose an HTTP controller.

## Key Files

| File | Role |
| --- | --- |
| `metrics.module.ts` | Registers `HttpModule`, `PrometheusService`, and `MetricsService`. |
| `prometheus.service.ts` | Builds PromQL queries and calls the Prometheus HTTP API. |
| `metrics.service.ts` | Polls metrics, caches results, tracks health, emits events. |
| `types/metrics.types.ts` | `MetricsScope` and `GatewayMetrics` shapes. |
| `events/metrics.events.ts` | Event names and payload contracts. |
| `*.spec.ts` | Unit tests for metrics and Prometheus behavior. |

## Public Service API

### `MetricsService`

| Method | Input | Output |
| --- | --- | --- |
| `setScopes(scopes)` | `MetricsScope[]` | Updates the list of scopes polled on the schedule. |
| `queryGatewayMetrics(scope, range?)` | Scope and range, default `5m` | Current `GatewayMetrics` from Prometheus. |
| `queryPrometheusScalar(query)` | PromQL string | Single numeric value. |
| `getLatest(scope)` | Scope | Cached `GatewayMetrics` or `null`. |
| `getServiceHealth(serviceId)` | Service id | `true`, `false`, or `null`. |

### `PrometheusService`

| Method | Input | Output |
| --- | --- | --- |
| `queryGatewayMetrics(filter, range?)` | Consumer/service scope and range | Normalized `GatewayMetrics`. |
| `queryScalar(query)` | PromQL string | Number. |
| `queryRange(query, start, end, step)` | Prometheus range query params | Raw Prometheus response. |

## Metric Shape

```ts
interface GatewayMetrics {
  totalRequests: number;
  requestsPerSecond: number;
  statusCodes: Record<string, number>;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
}
```

## Scope Shape

```ts
interface MetricsScope {
  consumerId?: string;
  serviceId?: string;
}
```

Scope labels are converted into Kong service label filters:

- consumer and service: `{service="<consumerId>-<serviceId>-svc"}`
- consumer only: `{service=~"<consumerId>-.*"}`
- service only: `{service=~".*-<serviceId>-svc"}`
- neither: global query with no service label filter

## Events Emitted

| Event | When | Payload |
| --- | --- | --- |
| `metrics.updated` | Cached metrics changed for a scope. | `{ consumerId, serviceId, metrics, timestamp }` |
| `metrics.poll.failed` | Prometheus query failed. | `{ consumerId, serviceId, source: "prometheus", error, timestamp }` |
| `health.changed` | Service health switches true/false. | `{ serviceId, healthy, consecutiveErrorWindows, timestamp }` |

## Health Logic

For service-specific scopes, health is derived from status codes:

- any `5xx` or `429` response increments the service error window counter
- after 10 consecutive error windows, health becomes `false`
- a clean window resets the counter and health becomes `true`

## External Dependency

Prometheus base URL:

```text
PROMETHEUS_URL || http://localhost:9090
```

The module queries:

- `/api/v1/query`
- `/api/v1/query_range`

## Persistence

Metrics cache, health state, and error counters are in memory only. They reset
when the backend restarts.
