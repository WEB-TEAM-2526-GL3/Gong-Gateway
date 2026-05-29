import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { MonitoringRuleType } from './entities/monitoring-rule.entity';
import { IncidentSeverity } from './enums/incident-severity.enum';
import { MonitoringService } from './monitoring.service';
import { MetricsService } from '../metrics/metrics.service';

type RuleRecord = {
  id: string;
  name: string;
  serviceName: string;
  providerId: string | null;
  type: MonitoringRuleType;
  errorRateThreshold: number | null;
  latencyThresholdMs: number | null;
  metricWindow: string;
  cooldownMinutes: number;
  severity: IncidentSeverity;
  isActive: boolean;
  lastTriggeredAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

describe('MonitoringService', () => {
  const metricsServiceMock = {
    queryPrometheusScalar: jest.fn(),
  };

  const eventEmitterMock = {
    emit: jest.fn(),
  };

  const rules = new Map<string, RuleRecord>();
  let idCounter = 1;

  const rulesRepoMock = {
    findOneBy: jest.fn(async ({ id, name }: { id?: string; name?: string }) => {
      if (id) {
        return rules.get(id) ?? null;
      }
      if (name) {
        return (
          Array.from(rules.values()).find((rule) => rule.name === name) ?? null
        );
      }
      return null;
    }),
    create: jest.fn((input: Partial<RuleRecord>) => {
      const now = new Date('2026-05-29T00:00:00.000Z');
      return {
        id: `rule-${idCounter++}`,
        name: input.name ?? 'rule',
        serviceName: input.serviceName ?? 'service-a',
        providerId: input.providerId ?? null,
        type: input.type ?? MonitoringRuleType.ERROR_RATE,
        errorRateThreshold: input.errorRateThreshold ?? null,
        latencyThresholdMs: input.latencyThresholdMs ?? null,
        metricWindow: input.metricWindow ?? '5m',
        cooldownMinutes: input.cooldownMinutes ?? 15,
        severity: input.severity ?? IncidentSeverity.MEDIUM,
        isActive: input.isActive ?? true,
        lastTriggeredAt: input.lastTriggeredAt ?? null,
        createdAt: now,
        updatedAt: now,
      } satisfies RuleRecord;
    }),
    save: jest.fn(async (rule: RuleRecord) => {
      rules.set(rule.id, rule);
      return rule;
    }),
    find: jest.fn(async (options?: { where?: { isActive?: boolean } }) => {
      const values = Array.from(rules.values());
      if (options?.where?.isActive === true) {
        return values.filter((rule) => rule.isActive);
      }
      return values;
    }),
    remove: jest.fn(async (rule: RuleRecord) => {
      rules.delete(rule.id);
      return rule;
    }),
  };

  let service: MonitoringService;

  beforeEach(async () => {
    jest.clearAllMocks();
    rules.clear();
    idCounter = 1;

    const moduleRef = await Test.createTestingModule({
      providers: [
        MonitoringService,
        {
          provide: 'MonitoringRuleEntityRepository',
          useValue: rulesRepoMock,
        },
        {
          provide: MetricsService,
          useValue: metricsServiceMock,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitterMock,
        },
      ],
    })
      .overrideProvider('MonitoringRuleEntityRepository')
      .useValue(rulesRepoMock)
      .compile();

    service = moduleRef.get(MonitoringService);
  });

  it('creates, updates, and deletes monitoring rules', async () => {
    const created = await service.createRule({
      name: 'error-rate-high',
      serviceName: 'openai-svc',
      type: MonitoringRuleType.ERROR_RATE,
      errorRateThreshold: 0.1,
      metricWindow: '5m',
      cooldownMinutes: 15,
      severity: IncidentSeverity.HIGH,
    });

    expect(created).toMatchObject({
      name: 'error-rate-high',
      serviceName: 'openai-svc',
      type: MonitoringRuleType.ERROR_RATE,
      errorRateThreshold: 0.1,
      metricWindow: '5m',
      cooldownMinutes: 15,
      severity: IncidentSeverity.HIGH,
      isActive: true,
      lastTriggeredAt: null,
    });

    await expect(
      service.createRule({
        name: 'error-rate-high',
        serviceName: 'openai-svc',
        type: MonitoringRuleType.ERROR_RATE,
      }),
    ).rejects.toThrow(
      'A monitoring rule named "error-rate-high" already exists',
    );

    const updated = await service.updateRule(created.id, {
      isActive: false,
      cooldownMinutes: 30,
    });

    expect(updated).toMatchObject({
      id: created.id,
      isActive: false,
      cooldownMinutes: 30,
    });

    await service.deleteRule(created.id);
    await expect(service.findRule(created.id)).rejects.toThrow(
      `Monitoring rule "${created.id}" not found`,
    );
  });

  it('runs scheduled checks, emits events, and caches the last report', async () => {
    const triggeredRule = await service.createRule({
      name: 'latency-high',
      serviceName: 'openai-svc',
      type: MonitoringRuleType.LATENCY_P95,
      latencyThresholdMs: 100,
      metricWindow: '5m',
      cooldownMinutes: 15,
      severity: IncidentSeverity.CRITICAL,
    });

    metricsServiceMock.queryPrometheusScalar.mockResolvedValueOnce(250);

    const report = await service.runManualCheck();

    expect(metricsServiceMock.queryPrometheusScalar).toHaveBeenCalledWith(
      'histogram_quantile(0.95, sum(rate(kong_upstream_latency_ms_bucket{service="openai-svc"}[5m])) by (le))',
    );
    expect(report.totalRules).toBe(1);
    expect(report.triggeredRules).toBe(1);
    expect(report.results[0]).toMatchObject({
      ruleId: triggeredRule.id,
      ruleName: 'latency-high',
      triggered: true,
      currentValue: 250,
      threshold: 100,
    });
    expect(eventEmitterMock.emit).toHaveBeenCalledWith(
      'monitoring.threshold.exceeded',
      expect.objectContaining({
        ruleId: triggeredRule.id,
        ruleName: 'latency-high',
        serviceName: 'openai-svc',
        currentValue: 250,
        threshold: 100,
      }),
    );
    expect(service.getLastReport()).toEqual(report);
  });

  it('skips repeated alerts during cooldown', async () => {
    const rule = await service.createRule({
      name: 'error-rate-high',
      serviceName: 'gateway-svc',
      type: MonitoringRuleType.ERROR_RATE,
      errorRateThreshold: 0.1,
      metricWindow: '5m',
      cooldownMinutes: 15,
      severity: IncidentSeverity.MEDIUM,
    });

    rule.lastTriggeredAt = new Date(Date.now() - 60_000);
    rules.set(rule.id, rule);

    metricsServiceMock.queryPrometheusScalar.mockResolvedValueOnce(0.5);

    const report = await service.runManualCheck();

    expect(report.triggeredRules).toBe(1);
    expect(eventEmitterMock.emit).not.toHaveBeenCalledWith(
      'monitoring.threshold.exceeded',
      expect.anything(),
    );
    expect(rules.get(rule.id)?.lastTriggeredAt).toEqual(rule.lastTriggeredAt);
  });

  it('returns the latest cached report without rerunning', async () => {
    expect(service.getLastReport()).toBeNull();

    const rule = await service.createRule({
      name: 'upstream-down',
      serviceName: 'gateway-svc',
      type: MonitoringRuleType.UPSTREAM_HEALTH,
      cooldownMinutes: 15,
      severity: IncidentSeverity.MEDIUM,
    });

    metricsServiceMock.queryPrometheusScalar.mockResolvedValueOnce(0);

    const report = await service.runManualCheck();

    expect(service.getLastReport()).toEqual(report);
    expect(report.results[0]).toMatchObject({
      ruleId: rule.id,
      triggered: true,
      threshold: 1,
      currentValue: 0,
    });
  });
});
