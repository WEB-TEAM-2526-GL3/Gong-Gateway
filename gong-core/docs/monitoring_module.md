# Monitoring Module

## What `MonitoringModule` Exports

`MonitoringModule` exports one provider:

- `MonitoringService`

## What It Does

`MonitoringModule` is the anomaly-detection boundary for Kong metrics.
It owns monitoring rules, scheduled checks, and threshold evaluation.

It depends on the metrics module for telemetry access instead of querying
Prometheus directly.

### `MonitoringService`

Use this service when you need to manage monitoring rules or run anomaly checks.

It is responsible for:

- Creating, listing, updating, and deleting monitoring rules
- Running scheduled checks against active rules
- Running manual checks on demand
- Evaluating error-rate, latency, and upstream-health rules
- Applying per-rule cooldowns
- Emitting threshold-exceeded events when a rule fires
- Caching the last monitoring report

## Public API

### `MonitoringService`

- `createRule(dto)` — Creates a monitoring rule
- `listRules()` — Returns all monitoring rules
- `findRule(id)` — Returns one rule or throws if missing
- `updateRule(id, dto)` — Updates an existing rule
- `deleteRule(id)` — Deletes a rule
- `runManualCheck()` — Runs the monitoring checks immediately
- `getLastReport()` — Returns the last cached status report, or `null`

## Event Emitted

`MonitoringService` emits one domain event when a rule breaches its threshold
and the cooldown window has expired:

- `monitoring.threshold.exceeded` — Payload shape is defined in
  `src/monitoring/events/threshold-exceeded.event.ts`

The incident module listens to this event and records the anomaly as an
incident entry.

## How Other Modules Should Use It

- Use `MonitoringService` to manage rules or trigger a check.
- Subscribe to `monitoring.threshold.exceeded` if you need to react to a
  detected anomaly.
- Treat monitoring as a consumer of metrics, not as a Prometheus client.
- The incident module is the consumer that turns monitoring alerts into
  incident records.

## Notes

- The module starts its scheduled loop when `MonitoringService` is instantiated.
- Rule checks are cooldown-gated to avoid repeated alerts.
- Monitoring reads metrics through `MetricsService`.
