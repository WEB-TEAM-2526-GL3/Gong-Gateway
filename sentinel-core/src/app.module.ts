import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KongModule } from './kong/kong.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [KongModule, WebhooksModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
