# Metrics Module

## What `MetricsModule` Exports

`MetricsModule` exports two providers so other modules can consume metrics without depending on internal implementation details:

- `MetricsService`
- `PrometheusService`

## What It Does

`MetricsModule` is the gateway metrics boundary. It owns polling, caching, health tracking, and Prometheus querying.

### `PrometheusService`

Use this service when you need to query Prometheus directly.

It is responsible for:

- Building PromQL queries for gateway metrics
- Querying request totals and request rates
- Querying status code breakdowns
- Querying upstream latency percentiles
- Returning normalized `GatewayMetrics` objects

It does not manage caching or health state.

### `MetricsService`

Use this service when you need the current metrics state for a consumer/service scope.

It is responsible for:

- Polling Prometheus on a schedule
- Caching the latest metrics per scope
- Tracking service health state
- Emitting metrics events for other modules
- Exposing the latest cached metrics
- Exposing service health status

## Public API

### `MetricsService`

- `setScopes(scopes)` — Defines which consumer/service scopes will be polled
- `getLatest(scope)` — Returns the last cached metrics for a scope, or `null`
- `getServiceHealth(serviceId)` — Returns the current health state for a service, or `null`

### `PrometheusService`

- `queryGatewayMetrics(scope, range)` — Returns aggregated gateway metrics for a scope
- `queryRange(query, start, end, step)` — Runs an arbitrary Prometheus range query

## Events Emitted

`MetricsService` emits domain events through `EventEmitter2`.

- `metrics.updated` — Emitted when cached metrics change for a scope
- `metrics.poll.failed` — Emitted when Prometheus polling fails
- `health.changed` — Emitted when a service health state changes

The payload shapes live in `src/metrics/events/metrics.events.ts`.

## How Other Modules Should Use It

- Use `MetricsService` if you need the latest cached metrics or service health.
- Use `PrometheusService` only if you need a direct Prometheus query.
- Subscribe to the emitted events if you need to react to changes instead of polling manually.
- Treat the metrics module as read-oriented: other modules should consume its outputs, not duplicate its polling logic.

## Notes

- The module currently starts polling automatically when `MetricsService` is instantiated.
- The default scope is global when no scope is set.
- Health tracking is based on consecutive error windows and is only tracked per service, not globally.
