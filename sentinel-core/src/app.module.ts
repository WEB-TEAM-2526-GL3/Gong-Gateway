import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KongModule } from './kong/kong.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    KongModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
