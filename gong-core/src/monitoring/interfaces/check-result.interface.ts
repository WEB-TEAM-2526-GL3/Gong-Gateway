import { MonitoringRuleType } from '../entities/monitoring-rule.entity';

export interface CheckResult {
  ruleId: string;
  ruleName: string;
  serviceName: string;
  type: MonitoringRuleType;
  triggered: boolean;
  currentValue: number;
  threshold: number;
  reason?: string;
  checkedAt: Date;
}

export interface MonitoringStatusReport {
  checkedAt: Date;
  totalRules: number;
  activeRules: number;
  triggeredRules: number;
  results: CheckResult[];
}
