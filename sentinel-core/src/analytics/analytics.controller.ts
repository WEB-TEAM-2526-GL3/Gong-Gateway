import { Controller, Get, Logger, Sse } from '@nestjs/common';
import { Observable, fromEventPattern, map } from 'rxjs';
import { AnalyticsService, type KongMetrics } from './analytics.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Controller('api/analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Sse('metrics/stream')
  metricsStream(): Observable<any> {
    return fromEventPattern<KongMetrics>(
      (handler) => this.eventEmitter.on('metrics:updated', handler),
      (handler) => this.eventEmitter.off('metrics:updated', handler),
    ).pipe(
      map((metrics: KongMetrics) => ({ data: metrics })),
    );
  }

  @Get('metrics/current')
  getCurrentMetrics(): KongMetrics | null {
    return this.analyticsService.getCurrentMetrics();
  }

  @Get('alert/trigger')
  triggerAlert(): { message: string } {
    this.analyticsService.emitAlert({
      type: 'ALERT',
      severity: 'HIGH',
      message: 'Error rate exceeded 5%',
      timestamp: new Date().toISOString(),
    });
    return { message: 'Alert sent to all clients' };
  }
}
