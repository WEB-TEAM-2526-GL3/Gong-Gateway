import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RequestLimitRepository } from '../limits/request-limit.repository';
import { TokenLimitRepository } from '../limits/token-limit.repository';

@Injectable()
export class LimitsService {
  private readonly logger = new Logger(LimitsService.name);

  constructor(
    private readonly requestLimitRepo: RequestLimitRepository,
    private readonly tokenLimitRepo: TokenLimitRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.subscribeToMetrics();
  }

  private subscribeToMetrics(): void {
    // Request limits
    this.eventEmitter.on('metrics.updated', async (event: {
      clientId: string;
      providerId: string;
      metrics: { totalRequests: number };
    }) => {
      if (event.clientId === 'global' || event.providerId === 'global') return;

      const limit = await this.requestLimitRepo.findByClientAndProvider(
        event.clientId,
        event.providerId,
      );
      if (!limit) return;

      if (event.metrics.totalRequests >= limit.maxRequests) {
        this.eventEmitter.emit('limit.exceeded', {
          clientId: event.clientId,
          providerId: event.providerId,
          limitId: limit.id,
          limitType: 'request',
          current: event.metrics.totalRequests,
          max: limit.maxRequests,
        });
      }
    });

    // Token limits
    this.eventEmitter.on('ai.tokens.updated', async (event: {
      providerId: string;
      modelName: string;
      total: number;
    }) => {
      const limit = await this.tokenLimitRepo.findByProvider(event.providerId);
      if (!limit) return;

      if (event.total >= limit.maxTokens) {
        this.eventEmitter.emit('limit.exceeded', {
          clientId: 'global',
          providerId: event.providerId,
          limitId: limit.id,
          limitType: 'token',
          current: event.total,
          max: limit.maxTokens,
        });
      }
    });
  }
}