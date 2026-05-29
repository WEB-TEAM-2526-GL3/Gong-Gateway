import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrometheusService } from './prometheus.service';

import type {
  HealthChangedEvent,
  MetricsPollFailedEvent,
  MetricsUpdatedEvent,
} from './events/metrics.events.js';
import type { GatewayMetrics, MetricsScope } from './types/metrics.types.js';

interface CachedMetrics {
  metrics: GatewayMetrics;
  timestamp: Date;
}

@Injectable()
export class MetricsService implements OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  private readonly cache = new Map<string, CachedMetrics>();
  private readonly errorCounters = new Map<string, number>();
  private readonly healthState = new Map<string, boolean>();
  private pollInterval?: NodeJS.Timeout;
  private scopes: MetricsScope[] = [{}];

  constructor(
    private readonly prometheus: PrometheusService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.startPolling();
  }

  onModuleDestroy(): void {
    this.stopPolling();
  }

  setScopes(scopes: MetricsScope[]): void {
    this.scopes = scopes.length ? scopes.slice() : [{}];
  }

  queryGatewayMetrics(
    scope: MetricsScope,
    range = '5m',
  ): Promise<GatewayMetrics> {
    return this.prometheus.queryGatewayMetrics(scope, range);
  }

  queryPrometheusScalar(query: string): Promise<number> {
    return this.prometheus.queryScalar(query);
  }

  private startPolling(intervalMs = 15000): void {
    void this.pollAll();
    this.pollInterval = setInterval(() => {
      void this.pollAll();
    }, intervalMs);
  }

  private stopPolling(): void {
    if (!this.pollInterval) {
      return;
    }

    clearInterval(this.pollInterval);
    this.pollInterval = undefined;
  }

  private async pollAll(): Promise<void> {
    console.log('[MetricsService] pollAll start', { scopes: this.scopes });
    for (const scope of this.scopes) {
      try {
        const metrics = await this.queryGatewayMetrics(scope, '5m');
        const key = this.scopeKey(scope);
        const prev = this.cache.get(key);
        const timestamp = new Date();

        this.cache.set(key, { metrics, timestamp });

        const serviceId = scope.serviceId ?? 'global';
        this.updateServiceHealth(serviceId, metrics.statusCodes, timestamp);

        if (!prev || this.hasMetricsChanged(prev.metrics, metrics)) {
          const event: MetricsUpdatedEvent = {
            consumerId: scope.consumerId ?? 'global',
            serviceId,
            metrics,
            timestamp,
          };
          console.log('[MetricsService] metrics.updated', {
            ...event,
          });
          this.eventEmitter.emit('metrics.updated', event);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        this.logger.error(
          `Metrics poll failed for ${scope.consumerId ?? 'global'}:${scope.serviceId ?? 'global'} - ${errorMessage}`,
        );

        console.log('[MetricsService] metrics.poll.failed', {
          consumerId: scope.consumerId ?? 'global',
          serviceId: scope.serviceId ?? 'global',
          error: errorMessage,
        });

        const event: MetricsPollFailedEvent = {
          consumerId: scope.consumerId ?? 'global',
          serviceId: scope.serviceId ?? 'global',
          source: 'prometheus',
          error: errorMessage,
          timestamp: new Date(),
        };

        this.eventEmitter.emit('metrics.poll.failed', event);
      }
    }
  }

  getLatest(scope: MetricsScope): GatewayMetrics | null {
    const key = this.scopeKey(scope);
    return this.cache.get(key)?.metrics ?? null;
  }

  getServiceHealth(serviceId: string): boolean | null {
    return this.healthState.get(serviceId) ?? null;
  }

  private scopeKey(scope: MetricsScope): string {
    return `${scope.consumerId ?? 'global'}:${scope.serviceId ?? 'global'}`;
  }

  private updateServiceHealth(
    serviceId: string,
    statusCodes: Record<string, number>,
    timestamp: Date,
  ): void {
    if (serviceId === 'global') {
      return;
    }

    const hasErrors = this.hasErrorStatus(statusCodes);
    const current = this.errorCounters.get(serviceId) ?? 0;

    if (hasErrors) {
      const newCount = current + 1;
      this.errorCounters.set(serviceId, newCount);

      if (newCount >= 10 && this.healthState.get(serviceId) !== false) {
        this.healthState.set(serviceId, false);
        const event: HealthChangedEvent = {
          serviceId,
          healthy: false,
          consecutiveErrorWindows: newCount,
          timestamp,
        };
        console.log('[MetricsService] health.changed', {
          ...event,
        });
        this.eventEmitter.emit('health.changed', event);
      }

      return;
    }

    this.errorCounters.set(serviceId, 0);
    if (this.healthState.get(serviceId) !== true) {
      this.healthState.set(serviceId, true);
      const event: HealthChangedEvent = {
        serviceId,
        healthy: true,
        consecutiveErrorWindows: 0,
        timestamp,
      };
      console.log('[MetricsService] health.changed', {
        ...event,
      });
      this.eventEmitter.emit('health.changed', event);
    }
  }

  private hasErrorStatus(statusCodes: Record<string, number>): boolean {
    return Object.keys(statusCodes).some(
      (code) => code.startsWith('5') || code === '429',
    );
  }

  private hasMetricsChanged(
    prev: GatewayMetrics,
    next: GatewayMetrics,
  ): boolean {
    return (
      prev.totalRequests !== next.totalRequests ||
      prev.requestsPerSecond !== next.requestsPerSecond ||
      JSON.stringify(prev.statusCodes) !== JSON.stringify(next.statusCodes) ||
      prev.latency.p50 !== next.latency.p50 ||
      prev.latency.p95 !== next.latency.p95 ||
      prev.latency.p99 !== next.latency.p99
    );
  }
}
