import { HttpService } from '@nestjs/axios';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { IncidentSeverity } from '../incidents/enums/incident-severity.enum';
import { IncidentStatus } from '../incidents/enums/incident-status.enum';
import { IncidentEntity } from '../incidents/entities/incident.entity';
import { IncidentLogEntity } from '../incidents/entities/incident-log.entity';
import { CreateMonitoringRuleDto } from './dto/create-monitoring-rule.dto';
import { UpdateMonitoringRuleDto } from './dto/update-monitoring-rule.dto';
import {
  MonitoringRuleEntity,
  MonitoringRuleType,
} from './entities/monitoring-rule.entity';
import type {
  CheckResult,
  MonitoringStatusReport,
} from './interfaces/check-result.interface';

@Injectable()
export class MonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly prometheusUrl =
    process.env.PROMETHEUS_URL ?? 'http://localhost:9090';

  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private lastReport: MonitoringStatusReport | null = null;

  constructor(
    @InjectRepository(MonitoringRuleEntity)
    private readonly rulesRepo: Repository<MonitoringRuleEntity>,
    @InjectRepository(IncidentEntity)
    private readonly incidentsRepo: Repository<IncidentEntity>,
    @InjectRepository(IncidentLogEntity)
    private readonly logsRepo: Repository<IncidentLogEntity>,
    private readonly httpService: HttpService,
  ) {}

  onModuleInit() {
    const intervalMs = Number(process.env.MONITORING_INTERVAL_MS ?? 60_000);
    this.checkInterval = setInterval(() => {
      this.runScheduledCheck().catch((err) =>
        this.logger.error('Scheduled check failed', err),
      );
    }, intervalMs);
    this.logger.log(
      'Monitoring engine started — interval ' + intervalMs / 1000 + 's',
    );
  }

  onModuleDestroy() {
    if (this.checkInterval) clearInterval(this.checkInterval);
  }

  // ─── Rule management ─────────────────────────────────────────────

  async createRule(dto: CreateMonitoringRuleDto): Promise<MonitoringRuleEntity> {
    const existing = await this.rulesRepo.findOneBy({ name: dto.name });
    if (existing) {
      throw new ConflictException(
        'A monitoring rule named "' + dto.name + '" already exists',
      );
    }
    const rule = this.rulesRepo.create({
      name: dto.name,
      serviceName: dto.serviceName,
      providerId: dto.providerId ?? null,
      type: dto.type,
      errorRateThreshold: dto.errorRateThreshold ?? null,
      latencyThresholdMs: dto.latencyThresholdMs ?? null,
      metricWindow: dto.metricWindow ?? '5m',
      cooldownMinutes: dto.cooldownMinutes ?? 15,
      severity: dto.severity ?? IncidentSeverity.MEDIUM,
      isActive: true,
      lastTriggeredAt: null,
    });
    return this.rulesRepo.save(rule);
  }

  async listRules(): Promise<MonitoringRuleEntity[]> {
    return this.rulesRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findRule(id: string): Promise<MonitoringRuleEntity> {
    const rule = await this.rulesRepo.findOneBy({ id });
    if (!rule) {
      throw new NotFoundException('Monitoring rule "' + id + '" not found');
    }
    return rule;
  }

  async updateRule(
    id: string,
    dto: UpdateMonitoringRuleDto,
  ): Promise<MonitoringRuleEntity> {
    const rule = await this.findRule(id);
    Object.assign(rule, dto);
    return this.rulesRepo.save(rule);
  }

  async deleteRule(id: string): Promise<void> {
    const rule = await this.findRule(id);
    await this.rulesRepo.remove(rule);
  }

  // ─── Manual trigger & status ──────────────────────────────────────

  async runManualCheck(): Promise<MonitoringStatusReport> {
    return this.runScheduledCheck();
  }

  getLastReport(): MonitoringStatusReport | null {
    return this.lastReport;
  }

  // ─── Core detection loop ──────────────────────────────────────────

  async runScheduledCheck(): Promise<MonitoringStatusReport> {
    const allRules = await this.rulesRepo.find({ where: { isActive: true } });
    const results: CheckResult[] = [];

    await Promise.allSettled(
      allRules.map(async (rule) => {
        try {
          const result = await this.evaluateRule(rule);
          results.push(result);
          if (result.triggered) await this.handleTriggeredRule(rule, result);
        } catch (err) {
          this.logger.warn('Rule "' + rule.name + '" evaluation failed: ' + err);
        }
      }),
    );

    const report: MonitoringStatusReport = {
      checkedAt: new Date(),
      totalRules: allRules.length,
      activeRules: allRules.length,
      triggeredRules: results.filter((r) => r.triggered).length,
      results,
    };

    this.lastReport = report;
    this.logger.debug(
      'Check complete — ' + report.triggeredRules + '/' + report.totalRules + ' triggered',
    );
    return report;
  }

  // ─── Rule evaluation ──────────────────────────────────────────────

  private async evaluateRule(rule: MonitoringRuleEntity): Promise<CheckResult> {
    const base = {
      ruleId: rule.id,
      ruleName: rule.name,
      serviceName: rule.serviceName,
      type: rule.type,
      checkedAt: new Date(),
    };

    switch (rule.type) {
      case MonitoringRuleType.ERROR_RATE:
        return this.evaluateErrorRate(rule, base);
      case MonitoringRuleType.LATENCY_P95:
        return this.evaluateLatency(rule, base);
      case MonitoringRuleType.UPSTREAM_HEALTH:
        return this.evaluateUpstreamHealth(rule, base);
      default:
        return { ...base, triggered: false, currentValue: 0, threshold: 0 };
    }
  }

  private async evaluateErrorRate(
    rule: MonitoringRuleEntity,
    base: Omit<CheckResult, 'triggered' | 'currentValue' | 'threshold' | 'reason'>,
  ): Promise<CheckResult> {
    const threshold = Number(rule.errorRateThreshold ?? 0.1);
    const svc = rule.serviceName;
    const win = rule.metricWindow;
    const query =
      'sum(rate(kong_http_status{service="' + svc + '",code=~"4..|5.."}[' + win + '])) /' +
      ' sum(rate(kong_http_status{service="' + svc + '"}[' + win + ']))';
    const currentValue = await this.queryPrometheus(query);
    const triggered = currentValue > threshold;
    return {
      ...base,
      triggered,
      currentValue,
      threshold,
      reason: triggered
        ? 'Error rate ' + (currentValue * 100).toFixed(1) + '% exceeds threshold ' +
          (threshold * 100).toFixed(1) + '% on "' + svc + '"'
        : undefined,
    };
  }

  private async evaluateLatency(
    rule: MonitoringRuleEntity,
    base: Omit<CheckResult, 'triggered' | 'currentValue' | 'threshold' | 'reason'>,
  ): Promise<CheckResult> {
    const threshold = rule.latencyThresholdMs ?? 1000;
    const svc = rule.serviceName;
    const win = rule.metricWindow;
    const query =
      'histogram_quantile(0.95, sum(rate(kong_upstream_latency_ms_bucket{service="' +
      svc + '"}[' + win + '])) by (le))';
    const currentValue = await this.queryPrometheus(query);
    const triggered = currentValue > threshold;
    return {
      ...base,
      triggered,
      currentValue,
      threshold,
      reason: triggered
        ? 'P95 latency ' + currentValue.toFixed(0) + 'ms exceeds threshold ' + threshold + 'ms on "' + svc + '"'
        : undefined,
    };
  }

  private async evaluateUpstreamHealth(
    rule: MonitoringRuleEntity,
    base: Omit<CheckResult, 'triggered' | 'currentValue' | 'threshold' | 'reason'>,
  ): Promise<CheckResult> {
    const query = 'min(kong_upstream_target_health{upstream="' + rule.serviceName + '"})';
    const currentValue = await this.queryPrometheus(query);
    const triggered = currentValue === 0;
    return {
      ...base,
      triggered,
      currentValue,
      threshold: 1,
      reason: triggered
        ? 'Upstream "' + rule.serviceName + '" is unhealthy (all targets down)'
        : undefined,
    };
  }

  // ─── Incident creation ────────────────────────────────────────────

  private async handleTriggeredRule(
    rule: MonitoringRuleEntity,
    result: CheckResult,
  ): Promise<void> {
    if (!this.isCooldownExpired(rule)) {
      this.logger.debug('Rule "' + rule.name + '" is in cooldown — skipping');
      return;
    }
    await this.createIncident(rule, result.reason ?? 'Rule "' + rule.name + '" triggered');
    rule.lastTriggeredAt = new Date();
    await this.rulesRepo.save(rule);
    this.logger.warn('Incident auto-created by rule "' + rule.name + '"');
  }

  private isCooldownExpired(rule: MonitoringRuleEntity): boolean {
    if (!rule.lastTriggeredAt) return true;
    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
    return Date.now() - rule.lastTriggeredAt.getTime() > cooldownMs;
  }

  private async createIncident(
    rule: MonitoringRuleEntity,
    reason: string,
  ): Promise<IncidentEntity> {
    const id = randomUUID();
    const dummyUuid = randomUUID();
    const incident = this.incidentsRepo.create({
      id,
      serviceId: rule.providerId ?? dummyUuid,
      providerId: rule.providerId ?? dummyUuid,
      severity: rule.severity,
      reason,
      status: IncidentStatus.OPEN,
      fallbackProviderId: null,
      resolvedAt: null,
    });
    const saved = await this.incidentsRepo.save(incident);
    await this.logsRepo.save(
      this.logsRepo.create({
        incidentId: saved.id,
        incident: saved,
        adminId: null,
        action: 'CREATED',
        details: {
          triggeredByRule: rule.name,
          ruleType: rule.type,
          serviceName: rule.serviceName,
        },
      }),
    );
    return saved;
  }

  // ─── Prometheus helper ────────────────────────────────────────────

  private async queryPrometheus(query: string): Promise<number> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<PrometheusResponse>(
          this.prometheusUrl + '/api/v1/query',
          { params: { query } },
        ),
      );
      if (data.status === 'success' && data.data.result.length > 0) {
        return parseFloat(data.data.result[0].value[1]);
      }
      return 0;
    } catch {
      return 0;
    }
  }
}

interface PrometheusResponse {
  status: 'success' | 'error';
  data: {
    result: Array<{
      metric: Record<string, string>;
      value: [number, string];
    }>;
  };
}
