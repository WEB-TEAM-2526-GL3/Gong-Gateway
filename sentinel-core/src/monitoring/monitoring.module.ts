import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentLogEntity } from '../incidents/entities/incident-log.entity';
import { IncidentEntity } from '../incidents/entities/incident.entity';
import { MonitoringRuleEntity } from './entities/monitoring-rule.entity';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MonitoringRuleEntity,
      IncidentEntity,
      IncidentLogEntity,
    ]),
    HttpModule,
  ],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
