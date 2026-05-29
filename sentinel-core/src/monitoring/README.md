# Monitoring Module

## Purpose

`MonitoringModule` is the anomaly detection layer. It stores monitoring rules,
periodically queries Prometheus through `MetricsService`, compares live values
against configured thresholds, and emits an event when a rule is breached.

It does not create incidents directly. The incidents module listens to the
monitoring event and creates incident records.

## Key Files

| File | Role |
| --- | --- |
| `monitoring.module.ts` | Registers TypeORM rule repository, controller, service, and `MetricsModule`. |
| `monitoring.controller.ts` | Exposes JWT-protected `/monitoring` REST API. |
| `monitoring.service.ts` | Owns rule CRUD, scheduled checks, threshold evaluation, cooldown, and event emission. |
| `entities/monitoring-rule.entity.ts` | TypeORM `monitoring_rules` table and rule type enum. |
| `dto/*.ts` | Create and update rule input contracts. |
| `events/threshold-exceeded.event.ts` | Event name and payload class for triggered rules. |
| `interfaces/check-result.interface.ts` | Per-rule and aggregate report shapes. |
| `enums/incident-severity.enum.ts` | Severity enum used on monitoring rules. |
| `monitoring.service.spec.ts` | Unit tests for rule CRUD, checks, cooldown, and event emission. |

## HTTP API

Base path: `/monitoring`

All routes require:

```http
Authorization: Bearer <accessToken>
```

| Method | Path | Input | Output |
| --- | --- | --- | --- |
| `POST` | `/rules` | `CreateMonitoringRuleDto` | Created monitoring rule. |
| `GET` | `/rules` | None | All monitoring rules. |
| `GET` | `/rules/:id` | Path id | One monitoring rule. |
| `PATCH` | `/rules/:id` | `UpdateMonitoringRuleDto` | Updated monitoring rule. |
| `DELETE` | `/rules/:id` | Path id | `204 No Content`. |
| `POST` | `/check` | None | Runs a check immediately and returns a report. |
| `GET` | `/status` | None | Last cached check report, or `404` before any check. |

## Rule Types

| Type | Measurement | Trigger |
| --- | --- | --- |
| `ERROR_RATE` | 4xx/5xx rate divided by total request rate. | Current value is greater than `errorRateThreshold`. |
| `LATENCY_P95` | P95 upstream latency in milliseconds. | Current value is greater than `latencyThresholdMs`. |
| `UPSTREAM_HEALTH` | Minimum Kong upstream target health. | Current value equals `0`. |

## Create Rule Input

```ts
{
  name: string;
  serviceName: string;
  providerId?: string;
  type: "ERROR_RATE" | "LATENCY_P95" | "UPSTREAM_HEALTH";
  errorRateThreshold?: number;
  latencyThresholdMs?: number;
  metricWindow?: string;
  cooldownMinutes?: number;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}
```

Defaults:

- `metricWindow`: `5m`
- `cooldownMinutes`: `15`
- `severity`: `MEDIUM`
- `isActive`: `true`

## Check Report Output

```ts
{
  checkedAt: Date;
  totalRules: number;
  activeRules: number;
  triggeredRules: number;
  results: Array<{
    ruleId: string;
    ruleName: string;
    serviceName: string;
    type: MonitoringRuleType;
    triggered: boolean;
    currentValue: number;
    threshold: number;
    reason?: string;
    checkedAt: Date;
  }>;
}
```

## Scheduled Detection

On module init, `MonitoringService` starts a `setInterval`.

Interval:

```text
MONITORING_INTERVAL_MS || 60000
```

Each cycle:

1. Loads active rules from Postgres.
2. Runs the relevant Prometheus query for each rule.
3. Builds a per-rule result.
4. If triggered and cooldown expired, emits `monitoring.threshold.exceeded`.
5. Updates `lastTriggeredAt`.
6. Stores the aggregate report in memory as `lastReport`.

## Event Emitted

Event name:

```text
monitoring.threshold.exceeded
```

Payload:

```ts
{
  ruleId: string;
  ruleName: string;
  serviceName: string;
  providerId: string | null;
  type: MonitoringRuleType;
  severity: IncidentSeverity;
  currentValue: number;
  threshold: number;
  reason: string;
  detectedAt: Date;
}
```

## Persistence

The `monitoring_rules` table stores:

- rule identity and watched service/provider
- rule type and threshold fields
- metric window
- cooldown
- active flag
- severity
- last trigger time
- timestamps

The last status report is in memory only.
