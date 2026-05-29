export interface MetricsScope {
  consumerId?: string;
  serviceId?: string;
}

export interface GatewayMetrics {
  totalRequests: number;
  requestsPerSecond: number;
  statusCodes: Record<string, number>;
  latency: { p50: number; p95: number; p99: number };
}
