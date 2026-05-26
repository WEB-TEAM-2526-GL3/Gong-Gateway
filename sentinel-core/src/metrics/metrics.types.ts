export interface MetricsFilter {
  serviceName?: string;
  routeName?: string;
  statusCode?: string;        // exact "200" or regex "4.."
}

export interface LatencyMetrics {
  p50: number;
  p95: number;
  p99: number;
}

export interface ServiceMetrics {
  requests: number;
  errorRate: number;
  latency: LatencyMetrics;
}