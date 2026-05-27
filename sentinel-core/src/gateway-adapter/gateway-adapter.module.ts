import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { KongAdapterService } from './kong/kong-adapter.service';
import { GatewayController } from './gateway.controller';

@Module({
  imports: [HttpModule],
  controllers: [GatewayController],
  providers: [KongAdapterService],
  exports: [KongAdapterService],
})
export class GatewayAdapterModule {}
