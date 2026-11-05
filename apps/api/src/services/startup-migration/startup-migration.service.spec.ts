import { PROPERTY_HAS_HISTORICAL_FX_MIGRATION } from '@ghostfolio/common/config';

import { StartupMigrationService } from './startup-migration.service';

describe('StartupMigrationService', () => {
  let service: StartupMigrationService;
  let ecbFxRateService: { backfillHistoricalRates: jest.Mock };
  let propertyService: { getByKey: jest.Mock; put: jest.Mock };
  let portfolioSnapshotQueue: { clean: jest.Mock };

  beforeEach(() => {
    ecbFxRateService = {
      backfillHistoricalRates: jest.fn().mockResolvedValue(undefined)
    };

    propertyService = {
      getByKey: jest.fn().mockResolvedValue(null),
      put: jest.fn().mockResolvedValue(undefined)
    };

    portfolioSnapshotQueue = {
      clean: jest.fn().mockResolvedValue(undefined)
    };

    service = new StartupMigrationService(
      ecbFxRateService as any,
      propertyService as any,
      portfolioSnapshotQueue as any
    );
  });

  it('TC-020: runs backfill and sets migration flag when not yet migrated', async () => {
    propertyService.getByKey.mockResolvedValue(null);

    await service.onApplicationBootstrap();

    expect(ecbFxRateService.backfillHistoricalRates).toHaveBeenCalledTimes(1);
    expect(propertyService.put).toHaveBeenCalledWith({
      key: PROPERTY_HAS_HISTORICAL_FX_MIGRATION,
      value: 'true'
    });
  });

  it('TC-021: skips migration entirely when flag already set', async () => {
    propertyService.getByKey.mockResolvedValue('true');

    await service.onApplicationBootstrap();

    expect(ecbFxRateService.backfillHistoricalRates).not.toHaveBeenCalled();
    expect(propertyService.put).not.toHaveBeenCalled();
  });

  it('TC-022: cleans portfolio snapshot queue to trigger recomputation', async () => {
    propertyService.getByKey.mockResolvedValue(null);

    await service.onApplicationBootstrap();

    expect(portfolioSnapshotQueue.clean).toHaveBeenCalledWith(0, 'completed');
    expect(portfolioSnapshotQueue.clean).toHaveBeenCalledWith(0, 'failed');
  });
});
