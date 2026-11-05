import { EcbFxRateModule } from '@ghostfolio/api/services/ecb-fx-rate/ecb-fx-rate.module';
import { PropertyModule } from '@ghostfolio/api/services/property/property.module';
import { PortfolioSnapshotQueueModule } from '@ghostfolio/api/services/queues/portfolio-snapshot/portfolio-snapshot.module';

import { Module } from '@nestjs/common';

import { StartupMigrationService } from './startup-migration.service';

@Module({
  imports: [EcbFxRateModule, PortfolioSnapshotQueueModule, PropertyModule],
  providers: [StartupMigrationService]
})
export class StartupMigrationModule {}
