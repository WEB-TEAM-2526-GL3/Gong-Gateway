import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MetricsService } from './metrics.service';

@Module({
  imports: [HttpModule],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}