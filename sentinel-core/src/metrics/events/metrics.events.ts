import type { GatewayMetrics } from '../types/metrics.types.js';

export const METRICS_UPDATED_EVENT = 'metrics.updated' as const;
export const METRICS_POLL_FAILED_EVENT = 'metrics.poll.failed' as const;
export const HEALTH_CHANGED_EVENT = 'health.changed' as const;

export interface MetricsUpdatedEvent {
  consumerId: string;
  serviceId: string;
  metrics: GatewayMetrics;
  timestamp: Date;
}

export interface MetricsPollFailedEvent {
  consumerId: string;
  serviceId: string;
  source: 'prometheus';
  error: string;
  timestamp: Date;
}

export interface HealthChangedEvent {
  serviceId: string;
  healthy: boolean;
  consecutiveErrorWindows: number;
  timestamp: Date;
}
