import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incident } from './incident.entity';
import { FailoverRule } from './failover-rule.entity';
import { IncidentRepository } from './incident.repository';
import { FailoverRuleRepository } from './failover-rule.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Incident, FailoverRule])],
  providers: [IncidentRepository, FailoverRuleRepository],
  exports: [IncidentRepository, FailoverRuleRepository],
})
export class IncidentModule {}