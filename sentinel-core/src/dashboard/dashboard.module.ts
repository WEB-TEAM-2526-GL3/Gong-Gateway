import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { MetricsModule } from '../metrics/metrics.module';
import { LinkModule } from '../links/link.module';
import { ProviderModule } from '../providers/provider.module';
import { ClientModule } from '../clients/client.module';

@Module({
  imports: [MetricsModule, LinkModule, ProviderModule, ClientModule],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}