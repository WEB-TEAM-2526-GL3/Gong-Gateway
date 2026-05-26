# Metrics Infrastructure

## Overview

The metrics pipeline collects API call data from Kong, stores it in Prometheus for real-time querying, and exposes a NestJS `MetricsService` that hides all PromQL complexity behind clean method calls.

```
Kong (prometheus plugin) → Prometheus (scrape every 15s) → NestJS MetricsService → Facade
```

## Docker Compose Changes

Three additions to the base Kong setup:

### 1. Kong Plugins
```yaml
# docker-compose.yml — kong service
environment:
  KONG_PLUGINS: bundled    # Loads all standard plugins at startup (prometheus included)
```

### 2. decK Setup Container
```yaml
# docker-compose.yml
kong-setup:
  image: kong/deck:latest
  depends_on:
    kong:
      condition: service_healthy
  volumes:
    - ./kong.yaml:/kong.yaml
  command: gateway sync --kong-addr http://kong:8001 /kong.yaml
  restart: on-failure
```

Configures the global `prometheus` plugin with all metric types enabled. Runs once at startup, idempotent.

### 3. Prometheus Service
```yaml
# docker-compose.yml
prometheus:
  image: prom/prometheus:latest
  depends_on:
    kong:
      condition: service_healthy
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
    - ./rules.yml:/etc/prometheus/rules.yml
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.retention.time=1h'
    - '--storage.tsdb.retention.size=256MB'
  ports:
    - "9090:9090"
  restart: on-failure
```

## Configuration Files

### `kong.yaml` — Plugin Configuration
```yaml
_format_version: "3.0"
plugins:
  - name: prometheus
    config:
      status_code_metrics: true
      latency_metrics: true
      bandwidth_metrics: true
      upstream_health_metrics: true
```

### `prometheus.yml` — Scrape & Filtering
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - 'rules.yml'

scrape_configs:
  - job_name: 'kong'
    static_configs:
      - targets: ['kong:8001']
    metrics_path: /metrics
    scrape_interval: 15s
    metric_relabel_configs:
      # Drop Kong's internal noise (memory, nginx, shared dicts)
      - source_labels: [__name__]
        regex: 'kong_memory_.*|kong_nginx_.*|kong_node_info|kong_configuration_.*'
        action: drop
```

### `rules.yml` — Pre-Aggregated Metrics
```yaml
groups:
  - name: kong_aggregated
    interval: 1m
    rules:
      - record: kong:requests:rate5m
        expr: rate(kong_http_requests_total[5m])
      - record: kong:errors:rate5m
        expr: rate(kong_http_status{code=~"[45].."}[5m])
      - record: kong:latency:p95_5m
        expr: histogram_quantile(0.95, rate(kong_upstream_latency_ms_bucket[5m]))
```

## MetricsService API

### Setup
```typescript
// src/metrics/metrics.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MetricsService } from './metrics.service';

@Module({
  imports: [HttpModule],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
```

### Usage
```typescript
// Inject into any NestJS service/controller
constructor(private readonly metrics: MetricsService) {}

// --- Basic queries ---

// Total requests for a service in the last 5 minutes
const count = await this.metrics.getRequestCount(
  { serviceName: 'openai-svc' },
  '5m'
);

// Error rate (0–1) for a specific route
const errorRate = await this.metrics.getErrorRate(
  { routeName: 'chat-external-route' },
  '15m'
);

// Latency percentiles
const p95 = await this.metrics.getLatencyPercentile(
  0.95,
  { serviceName: 'openai-svc', routeName: 'chat-route' }
);

// --- Convenience: all core metrics in one call ---
const overview = await this.metrics.getServiceMetrics(
  { serviceName: 'openai-svc' },
  '15m'
);
// → { requests: 1432, errorRate: 0.03, latency: { p50: 120, p95: 450, p99: 890 } }

// --- Health check ---
const healthy = await this.metrics.isUpstreamHealthy('openai-upstream');
// → true / false
```

### Available Filters
```typescript
interface MetricsFilter {
  serviceName?: string;    // e.g. "openai-svc"
  routeName?: string;      // e.g. "chat-external-route"
  statusCode?: string;     // e.g. "200" (exact) or "4..|5.." (regex)
}

// Time ranges use Prometheus duration syntax:
// "5m" "15m" "1h" "6h" "24h"
```

## How to Test

### 1. Bring up the stack
```bash
podman compose up -d
```

### 2. Verify Prometheus is scraping
```bash
http localhost:9090/api/v1/targets | jq '.data.activeTargets[0].health'
# Should return "up"
```

### 3. Create a test service and send traffic
```bash
http post localhost:8001/services name=test-svc url=http://httpbin.org
http post localhost:8001/services/test-svc/routes name=test-rt paths:='["/test"]'
for i in $(seq 1 5); do http localhost:8000/test/get > /dev/null; done
```

### 4. Wait for Prometheus scrape (15s), then query
```bash
sleep 20
http 'localhost:9090/api/v1/query' query=='kong_http_requests_total{service="test-svc"}'
# Should show a value of 5
```

### 5. Test pre-aggregated metrics (wait 1 minute for rules to fire)
```bash
sleep 60
http 'localhost:9090/api/v1/query' query=='kong:requests:rate5m{service="test-svc"}'
http 'localhost:9090/api/v1/query' query=='kong:latency:p95_5m{service="test-svc"}'
```

### 6. Clean up
```bash
http delete localhost:8001/services/test-svc/routes/test-rt
http delete localhost:8001/services/test-svc
```

## Retention & Performance

- **Raw data**: Retained for 1 hour, max 256MB disk
- **Pre-aggregated rules**: Computed every 1 minute from raw data
- **Kong internal metrics**: Dropped at scrape time (nginx, memory, shared dicts)
- **Per request**: ~30 metric series per HTTP call (latency histograms × 3 + bandwidth + status codes). Normal Prometheus behavior.

## Limitations

- **Streaming responses**: Total latency is captured correctly; response body size may not reflect full stream
- **Token-level metrics**: Not available through Kong's built-in plugins in OSS 3.4. Requires `post-function` Lua scripts or provider usage APIs.
- **Historical persistence**: Not yet implemented. `MetricsService` queries Prometheus directly (last 1h only). Hourly snapshots to PostgreSQL planned as follow-up.

---

Want me to adjust anything or create the next document?Here's the documentation for the metrics infrastructure module:

---

# Metrics Infrastructure

## Overview

The metrics pipeline collects API call data from Kong, stores it in Prometheus for real-time querying, and exposes a NestJS `MetricsService` that hides all PromQL complexity behind clean method calls.

```
Kong (prometheus plugin) → Prometheus (scrape every 15s) → NestJS MetricsService → Facade
```

## Docker Compose Changes

Three additions to the base Kong setup:

### 1. Kong Plugins
```yaml
# docker-compose.yml — kong service
environment:
  KONG_PLUGINS: bundled    # Loads all standard plugins at startup (prometheus included)
```

### 2. decK Setup Container
```yaml
# docker-compose.yml
kong-setup:
  image: kong/deck:latest
  depends_on:
    kong:
      condition: service_healthy
  volumes:
    - ./kong.yaml:/kong.yaml
  command: gateway sync --kong-addr http://kong:8001 /kong.yaml
  restart: on-failure
```

Configures the global `prometheus` plugin with all metric types enabled. Runs once at startup, idempotent.

### 3. Prometheus Service
```yaml
# docker-compose.yml
prometheus:
  image: prom/prometheus:latest
  depends_on:
    kong:
      condition: service_healthy
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
    - ./rules.yml:/etc/prometheus/rules.yml
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.retention.time=1h'
    - '--storage.tsdb.retention.size=256MB'
  ports:
    - "9090:9090"
  restart: on-failure
```

## Configuration Files

### `kong.yaml` — Plugin Configuration
```yaml
_format_version: "3.0"
plugins:
  - name: prometheus
    config:
      status_code_metrics: true
      latency_metrics: true
      bandwidth_metrics: true
      upstream_health_metrics: true
```

### `prometheus.yml` — Scrape & Filtering
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - 'rules.yml'

scrape_configs:
  - job_name: 'kong'
    static_configs:
      - targets: ['kong:8001']
    metrics_path: /metrics
    scrape_interval: 15s
    metric_relabel_configs:
      # Drop Kong's internal noise (memory, nginx, shared dicts)
      - source_labels: [__name__]
        regex: 'kong_memory_.*|kong_nginx_.*|kong_node_info|kong_configuration_.*'
        action: drop
```

### `rules.yml` — Pre-Aggregated Metrics
```yaml
groups:
  - name: kong_aggregated
    interval: 1m
    rules:
      - record: kong:requests:rate5m
        expr: rate(kong_http_requests_total[5m])
      - record: kong:errors:rate5m
        expr: rate(kong_http_status{code=~"[45].."}[5m])
      - record: kong:latency:p95_5m
        expr: histogram_quantile(0.95, rate(kong_upstream_latency_ms_bucket[5m]))
```

## MetricsService API

### Setup
```typescript
// src/metrics/metrics.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MetricsService } from './metrics.service';

@Module({
  imports: [HttpModule],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
```

### Usage
```typescript
// Inject into any NestJS service/controller
constructor(private readonly metrics: MetricsService) {}

// --- Basic queries ---

// Total requests for a service in the last 5 minutes
const count = await this.metrics.getRequestCount(
  { serviceName: 'openai-svc' },
  '5m'
);

// Error rate (0–1) for a specific route
const errorRate = await this.metrics.getErrorRate(
  { routeName: 'chat-external-route' },
  '15m'
);

// Latency percentiles
const p95 = await this.metrics.getLatencyPercentile(
  0.95,
  { serviceName: 'openai-svc', routeName: 'chat-route' }
);

// --- Convenience: all core metrics in one call ---
const overview = await this.metrics.getServiceMetrics(
  { serviceName: 'openai-svc' },
  '15m'
);
// → { requests: 1432, errorRate: 0.03, latency: { p50: 120, p95: 450, p99: 890 } }

// --- Health check ---
const healthy = await this.metrics.isUpstreamHealthy('openai-upstream');
// → true / false
```

### Available Filters
```typescript
interface MetricsFilter {
  serviceName?: string;    // e.g. "openai-svc"
  routeName?: string;      // e.g. "chat-external-route"
  statusCode?: string;     // e.g. "200" (exact) or "4..|5.." (regex)
}

// Time ranges use Prometheus duration syntax:
// "5m" "15m" "1h" "6h" "24h"
```

## How to Test

### 1. Bring up the stack
```bash
podman compose up -d
```

### 2. Verify Prometheus is scraping
```bash
http localhost:9090/api/v1/targets | jq '.data.activeTargets[0].health'
# Should return "up"
```

### 3. Create a test service and send traffic
```bash
http post localhost:8001/services name=test-svc url=http://httpbin.org
http post localhost:8001/services/test-svc/routes name=test-rt paths:='["/test"]'
for i in $(seq 1 5); do http localhost:8000/test/get > /dev/null; done
```

### 4. Wait for Prometheus scrape (15s), then query
```bash
sleep 20
http 'localhost:9090/api/v1/query' query=='kong_http_requests_total{service="test-svc"}'
# Should show a value of 5
```

### 5. Test pre-aggregated metrics (wait 1 minute for rules to fire)
```bash
sleep 60
http 'localhost:9090/api/v1/query' query=='kong:requests:rate5m{service="test-svc"}'
http 'localhost:9090/api/v1/query' query=='kong:latency:p95_5m{service="test-svc"}'
```

### 6. Clean up
```bash
http delete localhost:8001/services/test-svc/routes/test-rt
http delete localhost:8001/services/test-svc
```

## Retention & Performance

- **Raw data**: Retained for 1 hour, max 256MB disk
- **Pre-aggregated rules**: Computed every 1 minute from raw data
- **Kong internal metrics**: Dropped at scrape time (nginx, memory, shared dicts)
- **Per request**: ~30 metric series per HTTP call (latency histograms × 3 + bandwidth + status codes). Normal Prometheus behavior.

## Limitations

- **Streaming responses**: Total latency is captured correctly; response body size may not reflect full stream
- **Token-level metrics**: Not available through Kong's built-in plugins in OSS 3.4. Requires `post-function` Lua scripts or provider usage APIs.
- **Historical persistence**: Not yet implemented. `MetricsService` queries Prometheus directly (last 1h only). Hourly snapshots to PostgreSQL planned as follow-up.

