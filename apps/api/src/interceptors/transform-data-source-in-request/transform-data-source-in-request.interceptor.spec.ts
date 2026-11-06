import { encodeDataSource } from '@ghostfolio/api/helper/data-source.helper';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';

import { CallHandler, ExecutionContext } from '@nestjs/common';
import { DataSource } from '@prisma/client';
import { of } from 'rxjs';

import { TransformDataSourceInRequestInterceptor } from './transform-data-source-in-request.interceptor';

function createConfigurationService() {
  const configuration: Record<string, unknown> = {
    DATA_SOURCES_GHOSTFOLIO_DATA_PROVIDER: [],
    ENABLE_FEATURE_SUBSCRIPTION: true
  };

  return {
    get: jest.fn((key: string) => {
      return configuration[key];
    })
  } as unknown as ConfigurationService;
}

function intercept(aBody: object) {
  const request = { body: aBody, params: {}, query: {} };

  new TransformDataSourceInRequestInterceptor(
    createConfigurationService()
  ).intercept(
    {
      switchToHttp: () => {
        return { getRequest: () => request };
      }
    } as unknown as ExecutionContext,
    { handle: () => of(undefined) } as CallHandler
  );

  return request.body;
}

describe('TransformDataSourceInRequestInterceptor', () => {
  // CR-02: the symbol autocomplete gives encoded data sources
  it('decodes the data sources of the target allocations of a model', () => {
    const body = intercept({
      targetAllocations: {
        allocations: [
          {
            dataSource: encodeDataSource(DataSource.YAHOO),
            key: 'AAPL',
            targetPercent: 100
          }
        ],
        level: 'symbol'
      }
    }) as {
      targetAllocations: { allocations: { dataSource: string }[] };
    };

    expect(body.targetAllocations.allocations[0].dataSource).toBe(
      DataSource.YAHOO
    );
  });

  it('decodes the data sources of the target allocations of a calculation', () => {
    const body = intercept({
      config: {
        targetAllocations: {
          allocations: [
            {
              dataSource: encodeDataSource(DataSource.COINGECKO),
              key: 'bitcoin',
              targetPercent: 100
            }
          ],
          level: 'symbol'
        }
      }
    }) as {
      config: { targetAllocations: { allocations: { dataSource: string }[] } };
    };

    expect(body.config.targetAllocations.allocations[0].dataSource).toBe(
      DataSource.COINGECKO
    );
  });

  it('keeps target allocations without a data source unchanged', () => {
    const allocation = { key: 'EQUITY', targetPercent: 100 };

    const body = intercept({
      targetAllocations: { allocations: [allocation], level: 'assetClass' }
    }) as { targetAllocations: { allocations: object[] } };

    expect(body.targetAllocations.allocations[0]).toBe(allocation);
    expect(body.targetAllocations.allocations[0]).not.toHaveProperty(
      'dataSource'
    );
  });
});
