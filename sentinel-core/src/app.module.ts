import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KongAdapterModule } from './kong-adapter/kong-adapter.module';

@Module({
  imports: [KongAdapterModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
