import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringRuleEntity } from './entities/monitoring-rule.entity';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [TypeOrmModule.forFeature([MonitoringRuleEntity]), MetricsModule],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
