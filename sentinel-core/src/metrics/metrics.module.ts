import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrometheusService } from './prometheus.service';
import { MetricsService } from './metrics.service';

@Module({
  imports: [HttpModule.register({ timeout: 5000 })],
  providers: [PrometheusService, MetricsService],
  exports: [PrometheusService, MetricsService],
})
export class MetricsModule {}
