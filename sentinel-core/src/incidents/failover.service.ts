import { Injectable } from '@nestjs/common';
import { FailoverRuleRepository } from './failover-rule.repository';

@Injectable()
export class FailoverService {
  constructor(private readonly failoverRepo: FailoverRuleRepository) {}

  async shouldFailover(clientId: string, reason: 'dead' | 'limit'): Promise<boolean> {
    const rule = await this.failoverRepo.findByClient(clientId);
    if (!rule) return false;

    return reason === 'dead' ? rule.onDead : rule.onLimit;
  }
}