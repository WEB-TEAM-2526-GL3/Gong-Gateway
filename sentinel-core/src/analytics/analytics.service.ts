import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from 'eventemitter2';
import { firstValueFrom } from 'rxjs';

export interface KongMetrics {
  totalRequests: number;
  statusCodes: Record<string, number>;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  timestamp: string;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly KONG_METRICS_URL = 'http://localhost:8001/metrics';
  private metricsCache: KongMetrics | null = null;

  constructor(
    private readonly http: HttpService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.startMetricsPolling();
  }

  private startMetricsPolling() {
    setInterval(async () => {
      try {
        const metrics = await this.fetchKongMetrics();
        this.metricsCache = metrics;
        this.eventEmitter.emit('metrics:updated', metrics);
      } catch (error) {
        this.logger.error('Failed to fetch metrics:', error);
      }
    }, 2000);
  }

  async fetchKongMetrics(): Promise<KongMetrics> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(this.KONG_METRICS_URL, { responseType: 'text' }),
      );
      return this.parsePrometheusMetrics(data);
    } catch (error) {
      this.logger.error('Kong metrics fetch failed:', error);
      throw error;
    }
  }

  private parsePrometheusMetrics(rawMetrics: string): KongMetrics {
    const metrics: KongMetrics = {
      totalRequests: 0,
      statusCodes: {},
      latency: {
        p50: 0,
        p95: 0,
        p99: 0,
      },
      timestamp: new Date().toISOString(),
    };

    const lines = rawMetrics.split('\n');
    let proxyRequestMetricsFound = false;

    for (const line of lines) {
      if (line.startsWith('#') || !line.trim()) continue;

      // Count only proxied traffic from applications, not Kong's own Admin API calls.
      if (
        line.includes('http_requests_total') &&
        line.includes('source="service"')
      ) {
        const value = parseFloat(line.split(' ').pop() || '0');
        metrics.totalRequests += value;
        proxyRequestMetricsFound = true;

        const codeMatch = line.match(/code="(\d+)"/);
        if (codeMatch) {
          metrics.statusCodes[codeMatch[1]] =
            (metrics.statusCodes[codeMatch[1]] || 0) + value;
        }

        continue;
      }

      if (
        !proxyRequestMetricsFound &&
        line.includes('kong_nginx_requests_total') &&
        line.includes('subsystem="http"')
      ) {
        metrics.totalRequests = parseFloat(line.split(' ').pop() || '0');
      }

      if (line.includes('kong_http_status')) {
        const codeMatch = line.match(/code="(\d+)"/);
        const valueMatch = line.match(/}\s+([\d.]+)$/);
        if (codeMatch && valueMatch) {
          metrics.statusCodes[codeMatch[1]] = parseFloat(valueMatch[1]);
        }
      }

      if (line.includes('kong_http_latency_ms')) {
        if (line.includes('quantile="0.5"')) {
          metrics.latency.p50 = parseFloat(line.split(' ').pop() || '0');
        } else if (line.includes('quantile="0.95"')) {
          metrics.latency.p95 = parseFloat(line.split(' ').pop() || '0');
        } else if (line.includes('quantile="0.99"')) {
          metrics.latency.p99 = parseFloat(line.split(' ').pop() || '0');
        }
      }
    }

    return metrics;
  }

  getCurrentMetrics(): KongMetrics | null {
    return this.metricsCache;
  }

  emitAlert(alert: any) {
    this.eventEmitter.emit('alert', alert);
  }
}
