import { EcbFxRateService } from '@ghostfolio/api/services/ecb-fx-rate/ecb-fx-rate.service';
import { PropertyService } from '@ghostfolio/api/services/property/property.service';
import {
  PORTFOLIO_SNAPSHOT_COMPUTATION_QUEUE,
  PROPERTY_HAS_HISTORICAL_FX_MIGRATION
} from '@ghostfolio/common/config';

import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bull';

@Injectable()
export class StartupMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StartupMigrationService.name);

  public constructor(
    private readonly ecbFxRateService: EcbFxRateService,
    private readonly propertyService: PropertyService,
    @InjectQueue(PORTFOLIO_SNAPSHOT_COMPUTATION_QUEUE)
    private readonly portfolioSnapshotQueue: Queue
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    const alreadyMigrated = await this.propertyService.getByKey(
      PROPERTY_HAS_HISTORICAL_FX_MIGRATION
    );

    if (alreadyMigrated) {
      return;
    }

    this.logger.log(
      'Running historical FX migration — backfilling ECB rates and invalidating portfolio snapshots'
    );

    await this.ecbFxRateService.backfillHistoricalRates();

    await this.portfolioSnapshotQueue.clean(0, 'completed');
    await this.portfolioSnapshotQueue.clean(0, 'failed');

    await this.propertyService.put({
      key: PROPERTY_HAS_HISTORICAL_FX_MIGRATION,
      value: 'true'
    });

    this.logger.log('Historical FX migration complete');
  }
}
