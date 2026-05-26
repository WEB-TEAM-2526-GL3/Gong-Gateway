// src/metrics/metrics.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { MetricsFilter, LatencyMetrics, ServiceMetrics } from './metrics.types';

/**
 * Abstraction over Prometheus HTTP API for Kong metrics.
 * Hides all PromQL. Accepts high-level filters (service/route names)
 * and time ranges, returns clean numbers.
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly prometheusUrl =
    process.env.PROMETHEUS_URL || 'http://localhost:9090';

  constructor(private readonly http: HttpService) {}

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * Total requests that hit the matching Kong service/route in the given time window.
   * Uses `increase()` over the counter to get the absolute count of new requests.
   * 
   * @param filter  serviceName and/or routeName to narrow down
   * @param range   Prometheus duration string ("5m", "15m", "1h", "24h")
   * @returns       Number of requests in that window (0 if no data)
   */
  async getRequestCount(filter: MetricsFilter, range = '5m'): Promise<number> {
    const labels = this.buildLabelSelector(filter);
    const query = `sum(increase(kong_http_requests_total${labels}[${range}]))`;
    return this.querySingleValue(query);
  }

  /**
   * Fraction of 4xx/5xx responses among all requests for the matching service/route.
   * Returns a value between 0 and 1.
   * 
   * @param filter  serviceName and/or routeName (statusCode can override error pattern)
   * @param range   Prometheus duration string
   * @returns       Error rate 0–1 (0 if no traffic)
   */
  async getErrorRate(filter: MetricsFilter, range = '5m'): Promise<number> {
    const errorLabels = this.buildLabelSelector({
      ...filter,
      statusCode: filter.statusCode || '4..|5..',
    });
    const totalLabels = this.buildLabelSelector(filter);

    const errorsQuery = `sum(rate(kong_http_status${errorLabels}[${range}]))`;
    const totalQuery = `sum(rate(kong_http_status${totalLabels}[${range}]))`;

    const [errors, total] = await Promise.all([
      this.querySingleValue(errorsQuery),
      this.querySingleValue(totalQuery),
    ]);

    return total > 0 ? errors / total : 0;
  }

  /**
   * Upstream latency percentile in milliseconds.
   * Uses the histogram buckets exposed by Kong's prometheus plugin.
   * 
   * @param percentile  0.5 for p50, 0.95 for p95, 0.99 for p99
   * @param filter      serviceName and/or routeName
   * @param range       Prometheus duration string
   * @returns           Latency in milliseconds
   */
  async getLatencyPercentile(
    percentile: number,
    filter: MetricsFilter,
    range = '5m',
  ): Promise<number> {
    const labels = this.buildLabelSelector(filter);
    const query = `histogram_quantile(${percentile}, sum(rate(kong_upstream_latency_ms_bucket${labels}[${range}])) by (le))`;
    return this.querySingleValue(query);
  }

  /**
   * Convenience method: fetches request count, error rate, and p50/p95/p99
   * latency in a single call (4 parallel Prometheus queries).
   */
  async getServiceMetrics(
    filter: MetricsFilter,
    range = '5m',
  ): Promise<ServiceMetrics> {
    const [requests, errorRate, p50, p95, p99] = await Promise.all([
      this.getRequestCount(filter, range),
      this.getErrorRate(filter, range),
      this.getLatencyPercentile(0.5, filter, range),
      this.getLatencyPercentile(0.95, filter, range),
      this.getLatencyPercentile(0.99, filter, range),
    ]);

    return {
      requests,
      errorRate,
      latency: { p50, p95, p99 },
    };
  }

  /**
   * Checks whether the given upstream's targets are healthy.
   * The metric `kong_upstream_target_health` is 1 for healthy, 0 for unhealthy.
   * 
   * @param upstreamName  Kong upstream name (e.g. "openai-upstream")
   * @returns             true if all targets are healthy
   */
  async isUpstreamHealthy(upstreamName: string): Promise<boolean> {
    const query = `kong_upstream_target_health{upstream="${upstreamName}"}`;
    const value = await this.querySingleValue(query);
    return value === 1;
  }

  // ─── Private helpers ────────────────────────────────────────────

  /**
   * Builds a Prometheus label selector string from a MetricsFilter.
   * 
   * Examples:
   *   {serviceName: "openai-svc"}                    → `{service="openai-svc"}`
   *   {serviceName: "openai", routeName: "chat-rt"}  → `{service="openai",route="chat-rt"}`
   *   {statusCode: "4.."}                            → `{code=~"4.."}`
   *   {}                                             → `` (no filter = all services)
   */
  private buildLabelSelector(filter: MetricsFilter): string {
    const parts: string[] = [];

    if (filter.serviceName) {
      parts.push(`service="${filter.serviceName}"`);
    }
    if (filter.routeName) {
      parts.push(`route="${filter.routeName}"`);
    }
    if (filter.statusCode) {
      // If the code contains "." or "|", treat as regex match (=~), else exact (=)
      const isRegex =
        filter.statusCode.includes('.') || filter.statusCode.includes('|');
      parts.push(
        isRegex
          ? `code=~"${filter.statusCode}"`
          : `code="${filter.statusCode}"`,
      );
    }

    return parts.length > 0 ? `{${parts.join(',')}}` : '';
  }

  /**
   * Executes an instant Prometheus query and returns a single numeric value.
   * 
   * Calls GET /api/v1/query?query=... on Prometheus.
   * Returns 0 if the result vector is empty or Prometheus is unreachable.
   */
  private async querySingleValue(query: string): Promise<number> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<PrometheusQueryResponse>(
          `${this.prometheusUrl}/api/v1/query`,
          { params: { query } },
        ),
      );

      if (data.status === 'success' && data.data.result.length > 0) {
        // Instant query returns result[0].value = [unix_timestamp, "string_value"]
        return parseFloat(data.data.result[0].value![1]);
      }
      return 0;
    } catch (error) {
      this.logger.error(`Prometheus query failed`, {
        query,
        error: error.message,
      });
      return 0;
    }
  }
}

// ─── Prometheus API response types ────────────────────────────────

interface PrometheusQueryResponse {
  status: 'success' | 'error';
  data: {
    resultType: 'vector' | 'matrix' | 'scalar' | 'string';
    result: Array<{
      metric: Record<string, string>;
      value?: [number, string];
      values?: Array<[number, string]>;
    }>;
  };
  error?: string;
}