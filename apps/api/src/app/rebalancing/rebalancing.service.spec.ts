import { ImportService } from '@ghostfolio/api/app/import/import.service';
import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { DataProviderService } from '@ghostfolio/api/services/data-provider/data-provider.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { UNKNOWN_KEY } from '@ghostfolio/common/config';
import { SubscriptionType } from '@ghostfolio/common/enums';
import {
  AllocationTarget,
  DataProviderResponse,
  PortfolioPosition,
  RebalancingFeeConfig,
  RebalancingLevel
} from '@ghostfolio/common/interfaces';
import type { UserWithSettings } from '@ghostfolio/common/types';

import { HttpException } from '@nestjs/common';
import {
  AssetClass,
  AssetSubClass,
  DataSource,
  RebalancingMode
} from '@prisma/client';

import {
  MAX_NOT_HELD_SYMBOLS,
  MAX_REBALANCING_MODELS,
  RebalancingConfig,
  RebalancingService
} from './rebalancing.service';

const EUR_USD = 1.1;
const DATE = '2026-11-06T10:00:00.000Z';

// Converts between USD and EUR, any other pair is treated as equal
function convert(aValue: number, aFromCurrency: string, aToCurrency: string) {
  if (aFromCurrency === aToCurrency) {
    return aValue;
  }

  if (aFromCurrency === 'EUR' && aToCurrency === 'USD') {
    return aValue * EUR_USD;
  }

  if (aFromCurrency === 'USD' && aToCurrency === 'EUR') {
    return aValue / EUR_USD;
  }

  return aValue;
}

// Exchange rates are available between USD and EUR only, as in convert()
function hasExchangeRateOfUsdAndEur(
  aFromCurrency: string,
  aToCurrency: string
) {
  return (
    aFromCurrency === aToCurrency ||
    [aFromCurrency, aToCurrency].every((currency) => {
      return ['EUR', 'USD'].includes(currency);
    })
  );
}

function getPosition({
  assetClass,
  assetSubClass,
  currency = 'USD',
  marketPrice,
  name,
  quantity,
  sectors = [],
  symbol,
  valueInBaseCurrency
}: {
  assetClass?: AssetClass;
  assetSubClass?: AssetSubClass;
  currency?: string;
  marketPrice: number;
  name?: string;
  quantity: number;
  sectors?: { name: string; weight: number }[];
  symbol: string;
  valueInBaseCurrency: number;
}) {
  return {
    marketPrice,
    quantity,
    valueInBaseCurrency,
    assetProfile: {
      assetClass,
      assetSubClass,
      currency,
      sectors,
      symbol,
      dataSource: DataSource.YAHOO,
      name: name ?? symbol
    }
  } as PortfolioPosition;
}

/**
 * Fixture PF-1 of the QA test plan: base currency USD, total value 100,000,
 * EQUITY 70 %, FIXED_INCOME 20 %, LIQUIDITY 10 %
 */
function getPortfolio() {
  return {
    bnd: getPosition({
      assetClass: AssetClass.FIXED_INCOME,
      assetSubClass: AssetSubClass.ETF,
      marketPrice: 75,
      quantity: 20000 / 75,
      sectors: [{ name: 'Government', weight: 1 }],
      symbol: 'BND',
      valueInBaseCurrency: 20000
    }),
    cash: getPosition({
      assetClass: AssetClass.LIQUIDITY,
      assetSubClass: AssetSubClass.CASH,
      marketPrice: 1,
      quantity: 10000,
      symbol: 'USD',
      valueInBaseCurrency: 10000
    }),
    sap: getPosition({
      assetClass: AssetClass.EQUITY,
      assetSubClass: AssetSubClass.STOCK,
      currency: 'EUR',
      marketPrice: 180,
      quantity: 10000 / EUR_USD / 180,
      sectors: [{ name: 'Technology', weight: 1 }],
      symbol: 'SAP.DE',
      valueInBaseCurrency: 10000
    }),
    vti: getPosition({
      assetClass: AssetClass.EQUITY,
      assetSubClass: AssetSubClass.ETF,
      marketPrice: 250,
      quantity: 240,
      sectors: [
        { name: 'Financial Services', weight: 0.2 },
        { name: 'Technology', weight: 0.3 }
      ],
      symbol: 'VTI',
      valueInBaseCurrency: 60000
    })
  };
}

function getHoldings() {
  return Object.values(getPortfolio());
}

function getConfig({
  allocations,
  feeConfig,
  level = 'assetClass',
  mode = RebalancingMode.FULL,
  thresholdPercent = null
}: {
  allocations: AllocationTarget[];
  feeConfig?: RebalancingFeeConfig;
  level?: RebalancingLevel;
  mode?: RebalancingMode;
  thresholdPercent?: number | null;
}): RebalancingConfig {
  return {
    feeConfig,
    mode,
    thresholdPercent,
    targetAllocations: { allocations, level }
  };
}

const TARGET_60_30_10: AllocationTarget[] = [
  { key: AssetClass.EQUITY, targetPercent: 60 },
  { key: AssetClass.FIXED_INCOME, targetPercent: 30 },
  { key: AssetClass.LIQUIDITY, targetPercent: 10 }
];

describe('RebalancingService', () => {
  let count: jest.Mock;
  let create: jest.Mock;
  let deleteRebalancingModel: jest.Mock;
  let findFirst: jest.Mock;
  let findMany: jest.Mock;
  let getHoldingsOfPortfolio: jest.Mock;
  let getMaxActivitiesToImport: jest.Mock;
  let getQuotes: jest.Mock;
  let hasCurrencyPair: jest.Mock;
  let rebalancingService: RebalancingService;
  let update: jest.Mock;

  const user = {
    id: 'user-id',
    settings: { settings: { baseCurrency: 'USD' } }
  } as UserWithSettings;

  beforeEach(() => {
    count = jest.fn().mockResolvedValue(0);
    create = jest.fn();
    deleteRebalancingModel = jest.fn();
    findFirst = jest.fn();
    findMany = jest.fn().mockResolvedValue([]);
    getHoldingsOfPortfolio = jest.fn().mockResolvedValue(getHoldings());
    getMaxActivitiesToImport = jest.fn().mockReturnValue(1000);
    getQuotes = jest.fn().mockResolvedValue({});
    hasCurrencyPair = jest.fn(hasExchangeRateOfUsdAndEur);
    update = jest.fn();

    rebalancingService = new RebalancingService(
      { getQuotes } as unknown as DataProviderService,
      {
        hasCurrencyPair,
        toCurrency: convert
      } as unknown as ExchangeRateDataService,
      { getMaxActivitiesToImport } as unknown as ImportService,
      { getHoldings: getHoldingsOfPortfolio } as unknown as PortfolioService,
      {
        rebalancingModel: {
          count,
          create,
          findFirst,
          findMany,
          update,
          delete: deleteRebalancingModel
        }
      } as unknown as PrismaService
    );
  });

  const compute = ({
    config,
    hasExchangeRate = hasExchangeRateOfUsdAndEur,
    holdings = getHoldings(),
    quotes = {}
  }: {
    config: RebalancingConfig;
    hasExchangeRate?: (aFromCurrency: string, aToCurrency: string) => boolean;
    holdings?: PortfolioPosition[];
    quotes?: { [assetProfileIdentifier: string]: DataProviderResponse };
  }) => {
    return rebalancingService.computeRebalancing({
      config,
      convert,
      hasExchangeRate,
      holdings,
      quotes,
      baseCurrency: 'USD',
      date: DATE,
      maxActivitiesToImport: 1000
    });
  };

  const getTrade = (
    trades: ReturnType<typeof compute>['trades'],
    aSymbol: string
  ) => {
    return trades.find(({ symbol }) => {
      return symbol === aSymbol;
    });
  };

  describe('computeRebalancing', () => {
    // TC-012
    it('calculates the trades of a full rebalancing on the asset class level', () => {
      const result = compute({
        config: getConfig({ allocations: TARGET_60_30_10 })
      });

      expect(result.portfolioValueBeforeRebalancing).toBe(100000);
      expect(result.baseCurrency).toBe('USD');
      expect(result.isWithinTolerance).toBe(false);
      expect(result.trades).toHaveLength(3);

      const vti = getTrade(result.trades, 'VTI');
      expect(vti.action).toBe('SELL');
      expect(vti.estimatedValue).toBeCloseTo(8571.43, 2);
      expect(vti.quantity).toBeCloseTo(34.2857, 4);

      const sap = getTrade(result.trades, 'SAP.DE');
      expect(sap.action).toBe('SELL');
      expect(sap.estimatedValue).toBeCloseTo(1428.57, 2);

      const bnd = getTrade(result.trades, 'BND');
      expect(bnd.action).toBe('BUY');
      expect(bnd.estimatedValue).toBeCloseTo(10000, 2);
      expect(bnd.quantity).toBeCloseTo(133.3333, 4);

      // The liquidity is the residual bucket and is not traded
      expect(getTrade(result.trades, 'USD')).toBeUndefined();
      expect(result.projectedLiquidityPercent).toBeCloseTo(10, 4);
    });

    // TC-013
    it('puts a holding without an asset class into the unknown bucket', () => {
      const holdings = [
        ...getHoldings(),
        getPosition({
          marketPrice: 50,
          quantity: 100,
          symbol: 'MANUAL_ASSET',
          valueInBaseCurrency: 5000
        })
      ];

      const result = compute({
        holdings,
        config: getConfig({ allocations: TARGET_60_30_10 })
      });

      const manualAsset = getTrade(result.trades, 'MANUAL_ASSET');

      expect(manualAsset.action).toBe('SELL');
      expect(manualAsset.bucketKey).toBe(UNKNOWN_KEY);
      expect(manualAsset.quantity).toBeCloseTo(100, 4);
      expect(manualAsset.targetAllocationPercent).toBe(0);
    });

    // TC-014
    it('returns no trades if the portfolio is within tolerance and ignores closed holdings', () => {
      const holdings = [
        ...getHoldings(),
        getPosition({
          assetClass: AssetClass.EQUITY,
          marketPrice: 10,
          quantity: 0,
          symbol: 'CLOSED',
          valueInBaseCurrency: 0
        })
      ];

      const result = compute({
        holdings,
        config: getConfig({
          allocations: [
            { key: AssetClass.EQUITY, targetPercent: 70 },
            { key: AssetClass.FIXED_INCOME, targetPercent: 20 },
            { key: AssetClass.LIQUIDITY, targetPercent: 10 }
          ]
        })
      });

      expect(result.trades).toEqual([]);
      expect(result.isWithinTolerance).toBe(true);
      expect(result.excludedSymbols).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    // TC-015 and deviation D-6
    it('excludes a holding without a market price', () => {
      const portfolio = getPortfolio();

      for (const marketPrice of [null, 1]) {
        const result = compute({
          config: getConfig({ allocations: TARGET_60_30_10 }),
          holdings: [
            portfolio.cash,
            portfolio.sap,
            portfolio.vti,
            // The portfolio calculator falls back to a market price of 1
            { ...portfolio.bnd, marketPrice }
          ]
        });

        expect(getTrade(result.trades, 'BND')).toBeUndefined();
        expect(result.excludedSymbols).toEqual([
          {
            dataSource: DataSource.YAHOO,
            reason: 'NO_MARKET_PRICE',
            symbol: 'BND'
          }
        ]);
        expect(result.warnings).toContainEqual({
          code: 'UNFILLABLE_BUCKET',
          key: AssetClass.FIXED_INCOME
        });
      }
    });

    // TC-016
    it('adjusts every drifted bucket in the full mode', () => {
      const result = compute({
        config: getConfig({
          allocations: [
            { key: AssetClass.EQUITY, targetPercent: 65 },
            { key: AssetClass.FIXED_INCOME, targetPercent: 25 },
            { key: AssetClass.LIQUIDITY, targetPercent: 10 }
          ]
        })
      });

      expect(getTrade(result.trades, 'VTI').action).toBe('SELL');
      expect(getTrade(result.trades, 'SAP.DE').action).toBe('SELL');
      expect(getTrade(result.trades, 'BND').action).toBe('BUY');
      expect(getTrade(result.trades, 'BND').estimatedValue).toBeCloseTo(
        5000,
        2
      );
    });

    // TC-017
    it('does not trade the liquidity, but reaches its target via the cash', () => {
      const holdings = [
        ...getHoldings(),
        getPosition({
          assetClass: AssetClass.LIQUIDITY,
          assetSubClass: AssetSubClass.MUTUALFUND,
          marketPrice: 100,
          quantity: 50,
          symbol: 'MONEY_MARKET',
          valueInBaseCurrency: 5000
        })
      ];

      const result = compute({
        holdings,
        config: getConfig({ allocations: TARGET_60_30_10 })
      });

      expect(getTrade(result.trades, 'MONEY_MARKET')).toBeUndefined();
      expect(getTrade(result.trades, 'USD')).toBeUndefined();
      expect(result.projectedLiquidityPercent).toBeCloseTo(10, 4);

      const resultWithFees = compute({
        holdings,
        config: getConfig({
          allocations: TARGET_60_30_10,
          feeConfig: { flatFeePerTrade: 10, percentageFee: 0.1 }
        })
      });

      expect(resultWithFees.projectedLiquidityPercent).toBeLessThan(10);
      expect(resultWithFees.projectedLiquidityPercent).toBeGreaterThan(9.9);
    });

    // TC-018
    it('only trades the buckets beyond the threshold in the threshold mode', () => {
      const allocations: AllocationTarget[] = [
        { key: AssetClass.EQUITY, targetPercent: 67 },
        { key: AssetClass.FIXED_INCOME, targetPercent: 23 },
        { key: AssetClass.LIQUIDITY, targetPercent: 10 }
      ];

      const withinThreshold = compute({
        config: getConfig({
          allocations,
          mode: RebalancingMode.THRESHOLD,
          thresholdPercent: 5
        })
      });

      expect(withinThreshold.trades).toEqual([]);
      expect(withinThreshold.isWithinTolerance).toBe(true);

      const beyondThreshold = compute({
        config: getConfig({
          allocations,
          mode: RebalancingMode.THRESHOLD,
          thresholdPercent: 2
        })
      });

      expect(getTrade(beyondThreshold.trades, 'VTI').action).toBe('SELL');
      expect(getTrade(beyondThreshold.trades, 'BND').action).toBe('BUY');

      // The band of an allocation overrides the threshold
      const beyondBand = compute({
        config: getConfig({
          allocations: [
            {
              key: AssetClass.EQUITY,
              maxPercent: 68,
              minPercent: 66,
              targetPercent: 67
            },
            { key: AssetClass.FIXED_INCOME, targetPercent: 23 },
            { key: AssetClass.LIQUIDITY, targetPercent: 10 }
          ],
          mode: RebalancingMode.THRESHOLD,
          thresholdPercent: 5
        })
      });

      expect(getTrade(beyondBand.trades, 'VTI').action).toBe('SELL');
      expect(getTrade(beyondBand.trades, 'BND')).toBeUndefined();
    });

    // TC-019
    it('treats a threshold of 0 as a full rebalancing', () => {
      const allocations: AllocationTarget[] = [
        { key: AssetClass.EQUITY, targetPercent: 65 },
        { key: AssetClass.FIXED_INCOME, targetPercent: 25 },
        { key: AssetClass.LIQUIDITY, targetPercent: 10 }
      ];

      expect(
        compute({
          config: getConfig({
            allocations,
            mode: RebalancingMode.THRESHOLD,
            thresholdPercent: 0
          })
        }).trades
      ).toEqual(compute({ config: getConfig({ allocations }) }).trades);
    });

    // TC-020
    it('buys a symbol which is not held yet via its quote', () => {
      const config = getConfig({
        allocations: [
          { dataSource: DataSource.YAHOO, key: 'VTI', targetPercent: 50 },
          { dataSource: DataSource.YAHOO, key: 'BND', targetPercent: 20 },
          { dataSource: DataSource.YAHOO, key: 'SAP.DE', targetPercent: 10 },
          { dataSource: DataSource.YAHOO, key: 'AAPL', targetPercent: 20 }
        ],
        level: 'symbol'
      });

      const result = compute({
        config,
        quotes: {
          'YAHOO-AAPL': {
            currency: 'USD',
            dataSource: DataSource.YAHOO,
            marketPrice: 200,
            marketState: 'open'
          }
        }
      });

      const aapl = getTrade(result.trades, 'AAPL');

      expect(aapl.action).toBe('BUY');
      expect(aapl.dataSource).toBe(DataSource.YAHOO);
      expect(aapl.quantity).toBeCloseTo(100, 4);
      expect(aapl.currentAllocationPercent).toBe(0);
      expect(aapl.hasInsufficientCash).toBe(false);
      expect(getTrade(result.trades, 'VTI').estimatedValue).toBeCloseTo(
        10000,
        2
      );

      const resultWithoutQuote = compute({ config });

      expect(getTrade(resultWithoutQuote.trades, 'AAPL')).toBeUndefined();
      expect(resultWithoutQuote.excludedSymbols).toContainEqual({
        dataSource: DataSource.YAHOO,
        reason: 'NO_MARKET_PRICE',
        symbol: 'AAPL'
      });
    });

    // FM-01
    it('excludes a symbol which is not held yet if its currency has no exchange rate', () => {
      const config = getConfig({
        allocations: [
          { dataSource: DataSource.YAHOO, key: 'VTI', targetPercent: 50 },
          { dataSource: DataSource.YAHOO, key: 'BND', targetPercent: 20 },
          { dataSource: DataSource.YAHOO, key: 'SAP.DE', targetPercent: 10 },
          { dataSource: DataSource.YAHOO, key: '7203.T', targetPercent: 20 }
        ],
        level: 'symbol'
      });

      const quotes = {
        'YAHOO-7203.T': {
          currency: 'JPY',
          dataSource: DataSource.YAHOO,
          marketPrice: 2500,
          marketState: 'open' as const
        }
      };

      const result = compute({ config, quotes });

      // A conversion of 1:1 would buy 8 instead of about 1,200 shares
      expect(getTrade(result.trades, '7203.T')).toBeUndefined();
      expect(result.excludedSymbols).toContainEqual({
        dataSource: DataSource.YAHOO,
        reason: 'NO_EXCHANGE_RATE',
        symbol: '7203.T'
      });

      // With an exchange rate the symbol is bought
      const resultWithExchangeRate = compute({
        config,
        quotes,
        hasExchangeRate: () => {
          return true;
        }
      });

      expect(getTrade(resultWithExchangeRate.trades, '7203.T').action).toBe(
        'BUY'
      );
    });

    // TC-021
    it('reduces the quantity of a buy by the fees', () => {
      const result = compute({
        config: getConfig({
          allocations: TARGET_60_30_10,
          feeConfig: { flatFeePerTrade: 10, percentageFee: 0.1 }
        })
      });

      const bnd = getTrade(result.trades, 'BND');
      expect(bnd.estimatedValue).toBeCloseTo(9980.02, 2);
      expect(bnd.estimatedFee).toBeCloseTo(19.98, 2);
      expect(bnd.quantity).toBeCloseTo(133.0669, 4);

      // A sell keeps its quantity, the fee reduces its proceeds
      const vti = getTrade(result.trades, 'VTI');
      expect(vti.quantity).toBeCloseTo(34.2857, 4);
      expect(vti.estimatedFee).toBeCloseTo(10 + 8.5714, 4);

      const sap = getTrade(result.trades, 'SAP.DE');
      expect(sap.estimatedFee).toBeCloseTo(10 + 1.4286, 4);

      expect(result.totalEstimatedFees).toBeCloseTo(
        bnd.estimatedFee + vti.estimatedFee + sap.estimatedFee,
        8
      );
    });

    // TC-022
    it('drops a trade if the fee exceeds its value', () => {
      const result = compute({
        config: getConfig({
          allocations: [
            { key: AssetClass.EQUITY, targetPercent: 69.95 },
            { key: AssetClass.FIXED_INCOME, targetPercent: 20.05 },
            { key: AssetClass.LIQUIDITY, targetPercent: 10 }
          ],
          feeConfig: { flatFeePerTrade: 60, percentageFee: 0 }
        })
      });

      expect(result.trades).toEqual([]);
      expect(result.warnings).toContainEqual({
        code: 'FEE_EXCEEDS_TRADE',
        key: AssetClass.FIXED_INCOME
      });

      for (const { quantity } of result.trades) {
        expect(quantity).toBeGreaterThan(0);
      }
    });

    // TC-023
    it('gives the activity in the currency of the asset profile', () => {
      const result = compute({
        config: getConfig({
          allocations: TARGET_60_30_10,
          feeConfig: { flatFeePerTrade: 10, percentageFee: 0.1 }
        })
      });

      const sap = getTrade(result.trades, 'SAP.DE');

      expect(sap.currency).toBe('EUR');
      expect(sap.unitPrice).toBe(180);
      expect(sap.quantity).toBeCloseTo(sap.estimatedValue / EUR_USD / 180, 8);
      expect(sap.activity).toEqual({
        currency: 'EUR',
        dataSource: DataSource.YAHOO,
        date: DATE,
        fee: expect.closeTo(sap.estimatedFee / EUR_USD, 8),
        quantity: sap.quantity,
        symbol: 'SAP.DE',
        type: 'SELL',
        unitPrice: 180
      });
    });

    // TC-024
    it('flags the buys which exceed the available cash', () => {
      const result = compute({
        config: getConfig({
          allocations: [
            { dataSource: DataSource.YAHOO, key: 'VTI', targetPercent: 55 },
            { dataSource: DataSource.YAHOO, key: 'BND', targetPercent: 27 },
            { dataSource: DataSource.YAHOO, key: 'SAP.DE', targetPercent: 18 }
          ],
          level: 'symbol',
          mode: RebalancingMode.THRESHOLD,
          thresholdPercent: 6
        })
      });

      expect(getTrade(result.trades, 'VTI')).toBeUndefined();

      // The most underweight bucket is funded first
      expect(getTrade(result.trades, 'SAP.DE').hasInsufficientCash).toBe(false);
      expect(getTrade(result.trades, 'BND').hasInsufficientCash).toBe(true);
      expect(result.totalEstimatedFees).toBe(0);
    });

    // TC-037
    it('gives the drift as current minus target', () => {
      const result = compute({
        config: getConfig({ allocations: TARGET_60_30_10 })
      });

      expect(getTrade(result.trades, 'VTI').driftPercent).toBeCloseTo(10, 8);
      expect(getTrade(result.trades, 'BND').driftPercent).toBeCloseTo(-10, 8);
    });

    it('counts a fund spread across sectors in its largest sector', () => {
      const result = compute({
        config: getConfig({
          allocations: [
            { key: 'Government', targetPercent: 20 },
            { key: 'Technology', targetPercent: 80 }
          ],
          level: 'sector'
        })
      });

      // VTI (largest sector Technology) and SAP.DE are in Technology: 70,000
      // of 100,000, the cash is not a bucket on the level of the sector
      const vti = getTrade(result.trades, 'VTI');

      expect(vti.bucketKey).toBe('Technology');
      expect(vti.currentAllocationPercent).toBeCloseTo(70, 8);
      expect(vti.action).toBe('BUY');
    });

    // D-8
    it('drops a sell if its fee is at least its value', () => {
      const result = compute({
        config: getConfig({
          allocations: [
            { key: AssetClass.EQUITY, targetPercent: 69.95 },
            { key: AssetClass.FIXED_INCOME, targetPercent: 20.05 },
            { key: AssetClass.LIQUIDITY, targetPercent: 10 }
          ],
          feeConfig: { flatFeePerTrade: 60, percentageFee: 0 }
        })
      });

      // The sells of 42.86 (VTI) and 7.14 (SAP.DE) do not cover a fee of 60
      expect(getTrade(result.trades, 'VTI')).toBeUndefined();
      expect(getTrade(result.trades, 'SAP.DE')).toBeUndefined();
      expect(result.warnings).toContainEqual({
        code: 'FEE_EXCEEDS_TRADE',
        key: AssetClass.EQUITY
      });
    });

    // D-8, TC-015
    it('caps a sell at the tradeable value of a bucket with holdings without a market price', () => {
      const portfolio = getPortfolio();

      const result = compute({
        config: getConfig({
          allocations: [
            { key: AssetClass.EQUITY, targetPercent: 5 },
            { key: AssetClass.FIXED_INCOME, targetPercent: 85 },
            { key: AssetClass.LIQUIDITY, targetPercent: 10 }
          ]
        }),
        holdings: [
          portfolio.bnd,
          portfolio.cash,
          portfolio.vti,
          { ...portfolio.sap, marketPrice: null }
        ]
      });

      // EQUITY has to shrink by 65,000, but only VTI (60,000) can be sold
      const vti = getTrade(result.trades, 'VTI');

      expect(vti.action).toBe('SELL');
      expect(vti.estimatedValue).toBeCloseTo(60000, 2);
      expect(vti.quantity).toBeCloseTo(240, 8);
      expect(getTrade(result.trades, 'SAP.DE')).toBeUndefined();
      expect(result.excludedSymbols).toEqual([
        {
          dataSource: DataSource.YAHOO,
          reason: 'NO_MARKET_PRICE',
          symbol: 'SAP.DE'
        }
      ]);
      expect(result.warnings).toContainEqual({
        code: 'UNFILLABLE_BUCKET',
        key: AssetClass.EQUITY
      });
      expect(getTrade(result.trades, 'BND').hasInsufficientCash).toBe(false);
    });

    // TC-023, EC-006
    it('buys a symbol which is not held yet in the currency of its quote', () => {
      const result = compute({
        config: getConfig({
          allocations: [
            { dataSource: DataSource.YAHOO, key: 'VTI', targetPercent: 50 },
            { dataSource: DataSource.YAHOO, key: 'BND', targetPercent: 20 },
            { dataSource: DataSource.YAHOO, key: 'SAP.DE', targetPercent: 10 },
            { dataSource: DataSource.YAHOO, key: 'ASML.AS', targetPercent: 20 }
          ],
          feeConfig: { flatFeePerTrade: 10, percentageFee: 0 },
          level: 'symbol'
        }),
        quotes: {
          'YAHOO-ASML.AS': {
            currency: 'EUR',
            dataSource: DataSource.YAHOO,
            marketPrice: 600,
            marketState: 'open'
          }
        }
      });

      const asml = getTrade(result.trades, 'ASML.AS');

      // Cash 10,000 + sell of VTI 10,000 − its fee 10 = 19,990, which funds
      // the buy of 19,980 and its fee of 10 (CR-01)
      expect(asml.action).toBe('BUY');
      expect(asml.currency).toBe('EUR');
      expect(asml.hasInsufficientCash).toBe(false);
      expect(asml.estimatedValue).toBeCloseTo(19980, 2);
      expect(asml.estimatedFee).toBeCloseTo(10, 8);
      expect(asml.quantity).toBeCloseTo(19980 / EUR_USD / 600, 8);
      expect(asml.activity).toEqual({
        currency: 'EUR',
        dataSource: DataSource.YAHOO,
        date: DATE,
        fee: expect.closeTo(10 / EUR_USD, 8),
        quantity: asml.quantity,
        symbol: 'ASML.AS',
        type: 'BUY',
        unitPrice: 600
      });
    });

    it('sells the entire quantity of a holding which is not in the target', () => {
      const portfolio = getPortfolio();

      const result = compute({
        config: getConfig({
          allocations: [
            { dataSource: DataSource.YAHOO, key: 'VTI', targetPercent: 70 },
            { dataSource: DataSource.YAHOO, key: 'BND', targetPercent: 30 }
          ],
          level: 'symbol'
        })
      });

      const sap = getTrade(result.trades, 'SAP.DE');

      expect(sap.action).toBe('SELL');
      expect(sap.targetAllocationPercent).toBe(0);
      expect(sap.quantity).toBeCloseTo(portfolio.sap.quantity, 8);
    });

    // GH-2-TEST-01: the value and the market price can deviate within the
    // tolerance of the market price, a sell is capped at the held quantity
    it('never sells more than the held quantity', () => {
      const portfolio = getPortfolio();

      const result = compute({
        config: getConfig({
          allocations: [
            { dataSource: DataSource.YAHOO, key: 'BND', targetPercent: 100 }
          ],
          level: 'symbol'
        }),
        holdings: [
          portfolio.bnd,
          portfolio.cash,
          // The value deviates 2 % from 235 × 250 = 58,750
          { ...portfolio.vti, quantity: 235 }
        ]
      });

      const vti = getTrade(result.trades, 'VTI');

      expect(vti.quantity).toBe(235);
      expect(vti.activity.quantity).toBe(235);
      // The value follows the capped quantity: 235 × 250
      expect(vti.estimatedValue).toBeCloseTo(58750, 8);
    });

    // CR-01
    it('reduces a buy whose shortfall is caused by the fees of the sells', () => {
      const result = compute({
        config: getConfig({
          allocations: [
            { dataSource: DataSource.YAHOO, key: 'VTI', targetPercent: 50 },
            { dataSource: DataSource.YAHOO, key: 'BND', targetPercent: 30 },
            { dataSource: DataSource.YAHOO, key: 'SAP.DE', targetPercent: 20 }
          ],
          feeConfig: { flatFeePerTrade: 10, percentageFee: 0 },
          level: 'symbol'
        })
      });

      // Cash 10,000 + sell of VTI 10,000 − fee 10 = 19,990 for two buys of
      // 10,000 each (incl. their fees)
      const vti = getTrade(result.trades, 'VTI');
      const bnd = getTrade(result.trades, 'BND');
      const sap = getTrade(result.trades, 'SAP.DE');

      expect(vti.action).toBe('SELL');
      expect(bnd.hasInsufficientCash).toBe(false);
      expect(sap.hasInsufficientCash).toBe(false);

      const spentOnBuys =
        bnd.estimatedValue +
        bnd.estimatedFee +
        sap.estimatedValue +
        sap.estimatedFee;

      expect(spentOnBuys).toBeCloseTo(19990, 6);
      expect(Math.min(bnd.estimatedValue, sap.estimatedValue)).toBeCloseTo(
        9980,
        6
      );
      // The activity of the reduced buy is consistent with its value
      const reducedBuy = bnd.estimatedValue < sap.estimatedValue ? bnd : sap;

      expect(reducedBuy.activity.quantity).toBe(reducedBuy.quantity);
    });

    it('lists a held symbol without a market price only once', () => {
      const portfolio = getPortfolio();

      const result = compute({
        config: getConfig({
          allocations: [
            { dataSource: DataSource.YAHOO, key: 'VTI', targetPercent: 50 },
            { dataSource: DataSource.YAHOO, key: 'BND', targetPercent: 40 },
            { dataSource: DataSource.YAHOO, key: 'SAP.DE', targetPercent: 10 }
          ],
          level: 'symbol'
        }),
        holdings: [
          portfolio.cash,
          portfolio.sap,
          portfolio.vti,
          { ...portfolio.bnd, marketPrice: null }
        ]
      });

      expect(getTrade(result.trades, 'BND')).toBeUndefined();
      expect(result.excludedSymbols).toEqual([
        {
          dataSource: DataSource.YAHOO,
          reason: 'NO_MARKET_PRICE',
          symbol: 'BND'
        }
      ]);
    });

    it.each<RebalancingLevel>(['sector', 'symbol'])(
      'gives no projected liquidity on the level %s',
      (level) => {
        const result = compute({
          config: getConfig({
            level,
            allocations:
              level === 'sector'
                ? [
                    { key: 'Government', targetPercent: 30 },
                    { key: 'Technology', targetPercent: 70 }
                  ]
                : [
                    {
                      dataSource: DataSource.YAHOO,
                      key: 'VTI',
                      targetPercent: 70
                    },
                    {
                      dataSource: DataSource.YAHOO,
                      key: 'BND',
                      targetPercent: 30
                    }
                  ]
          })
        });

        expect(result.trades.length).toBeGreaterThan(0);
        expect(result.projectedLiquidityPercent).toBeNull();
      }
    );

    it('handles an empty portfolio without trades', () => {
      for (const holdings of [[], [{ ...getPortfolio().vti, quantity: 0 }]]) {
        const result = compute({
          holdings,
          config: getConfig({ allocations: TARGET_60_30_10 })
        });

        expect(result.portfolioValueBeforeRebalancing).toBe(0);
        expect(result.trades).toEqual([]);
        expect(result.totalEstimatedFees).toBe(0);
        expect(result.projectedLiquidityPercent).toBe(0);
        expect(result.warnings).toEqual([
          { code: 'UNFILLABLE_BUCKET', key: AssetClass.EQUITY },
          { code: 'UNFILLABLE_BUCKET', key: AssetClass.FIXED_INCOME }
        ]);
      }
    });

    it('never recommends a quantity which is not positive', () => {
      const result = compute({
        config: getConfig({
          allocations: [
            { key: AssetClass.EQUITY, targetPercent: 40 },
            { key: AssetClass.FIXED_INCOME, targetPercent: 55 },
            { key: AssetClass.LIQUIDITY, targetPercent: 5 }
          ],
          feeConfig: { flatFeePerTrade: 25, percentageFee: 1 }
        })
      });

      expect(result.trades.length).toBeGreaterThan(0);

      for (const { activity, estimatedFee, quantity } of result.trades) {
        expect(quantity).toBeGreaterThan(0);
        expect(activity.quantity).toBe(quantity);
        expect(estimatedFee).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('calculate', () => {
    // TC-010
    it('requires either a model or a configuration, but not both', async () => {
      for (const calculateRebalancingDto of [
        {},
        {
          config: getConfig({ allocations: TARGET_60_30_10 }),
          modelId: 'model-id'
        }
      ]) {
        await expect(
          rebalancingService.calculate({
            calculateRebalancingDto,
            user,
            userId: user.id
          })
        ).rejects.toMatchObject({ status: 400 });
      }

      expect(getHoldingsOfPortfolio).not.toHaveBeenCalled();
      expect(findFirst).not.toHaveBeenCalled();
    });

    // TC-035
    it('calculates an inline configuration without saving it', async () => {
      const result = await rebalancingService.calculate({
        user,
        calculateRebalancingDto: {
          config: getConfig({ allocations: TARGET_60_30_10 })
        },
        userId: user.id
      });

      expect(result.trades).toHaveLength(3);
      expect(result.maxActivitiesToImport).toBe(1000);
      expect(getHoldingsOfPortfolio).toHaveBeenCalledWith({
        dateRange: 'max',
        userId: user.id
      });
      expect(create).not.toHaveBeenCalled();
      expect(getQuotes).not.toHaveBeenCalled();
    });

    it('loads a saved model of the user', async () => {
      findFirst.mockResolvedValue({
        createdAt: new Date(),
        feeConfig: {},
        id: 'model-id',
        mode: RebalancingMode.FULL,
        name: 'Conservative 60/40',
        targetAllocations: {
          allocations: TARGET_60_30_10,
          level: 'assetClass'
        },
        thresholdPercent: null,
        updatedAt: new Date(),
        userId: user.id
      });

      const result = await rebalancingService.calculate({
        user,
        calculateRebalancingDto: { modelId: 'model-id' },
        userId: user.id
      });

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: 'model-id', userId: user.id }
      });
      expect(result.trades).toHaveLength(3);
    });

    // TC-020
    it('fetches the quotes of the symbols which are not held only', async () => {
      await rebalancingService.calculate({
        user,
        calculateRebalancingDto: {
          config: getConfig({
            allocations: [
              { dataSource: DataSource.YAHOO, key: 'VTI', targetPercent: 80 },
              { dataSource: DataSource.YAHOO, key: 'AAPL', targetPercent: 20 }
            ],
            level: 'symbol'
          })
        },
        userId: user.id
      });

      expect(getQuotes).toHaveBeenCalledTimes(1);
      expect(getQuotes).toHaveBeenCalledWith({
        items: [{ dataSource: DataSource.YAHOO, symbol: 'AAPL' }]
      });
    });

    // FM-01
    it('checks the exchange rate directly and via the default currency', async () => {
      const config = getConfig({
        allocations: [
          { dataSource: DataSource.YAHOO, key: 'VTI', targetPercent: 80 },
          { dataSource: DataSource.YAHOO, key: '7203.T', targetPercent: 20 }
        ],
        level: 'symbol'
      });

      getQuotes.mockResolvedValue({
        'YAHOO-7203.T': {
          currency: 'JPY',
          dataSource: DataSource.YAHOO,
          marketPrice: 2500,
          marketState: 'open'
        }
      });

      const eurUser = {
        ...user,
        settings: { settings: { baseCurrency: 'EUR' } }
      } as UserWithSettings;

      // No pair of JPY at all
      hasCurrencyPair.mockReturnValue(false);

      const withoutExchangeRate = await rebalancingService.calculate({
        calculateRebalancingDto: { config },
        user: eurUser,
        userId: user.id
      });

      expect(withoutExchangeRate.excludedSymbols).toContainEqual(
        expect.objectContaining({
          reason: 'NO_EXCHANGE_RATE',
          symbol: '7203.T'
        })
      );

      // JPY → EUR via USD (JPY-USD and USD-EUR exist)
      hasCurrencyPair.mockImplementation(
        (aCurrency1: string, aCurrency2: string) => {
          return (
            (aCurrency1 === 'JPY' && aCurrency2 === 'USD') ||
            (aCurrency1 === 'USD' && aCurrency2 === 'EUR')
          );
        }
      );

      const viaDefaultCurrency = await rebalancingService.calculate({
        calculateRebalancingDto: { config },
        user: eurUser,
        userId: user.id
      });

      expect(
        viaDefaultCurrency.excludedSymbols.some(({ symbol }) => {
          return symbol === '7203.T';
        })
      ).toBe(false);
      expect(hasCurrencyPair).toHaveBeenCalledWith('JPY', 'USD');
      expect(hasCurrencyPair).toHaveBeenCalledWith('USD', 'EUR');
    });

    // SEC-02
    it('fetches the quotes with the subscription type of the user', async () => {
      await rebalancingService.calculate({
        calculateRebalancingDto: {
          config: getConfig({
            allocations: [
              { dataSource: DataSource.YAHOO, key: 'VTI', targetPercent: 80 },
              { dataSource: DataSource.YAHOO, key: 'AAPL', targetPercent: 20 }
            ],
            level: 'symbol'
          })
        },
        user: {
          ...user,
          subscription: { type: SubscriptionType.Basic }
        } as UserWithSettings,
        userId: user.id
      });

      expect(getQuotes).toHaveBeenCalledWith({
        items: [{ dataSource: DataSource.YAHOO, symbol: 'AAPL' }],
        subscriptionType: SubscriptionType.Basic
      });
    });

    // SEC-02
    it('refuses more symbols which are not held yet than supported', async () => {
      const allocations = Array.from(
        { length: MAX_NOT_HELD_SYMBOLS + 1 },
        (_, index) => {
          return {
            dataSource: DataSource.YAHOO,
            key: `NOT_HELD_${index}`,
            targetPercent: 100 / (MAX_NOT_HELD_SYMBOLS + 1)
          };
        }
      );

      await expect(
        rebalancingService.calculate({
          user,
          calculateRebalancingDto: {
            config: getConfig({ allocations, level: 'symbol' })
          },
          userId: user.id
        })
      ).rejects.toMatchObject({ status: 400 });

      expect(getQuotes).not.toHaveBeenCalled();
    });

    it('excludes the symbols if the quotes cannot be fetched', async () => {
      getQuotes.mockRejectedValue(new Error('Data provider outage'));

      const result = await rebalancingService.calculate({
        user,
        calculateRebalancingDto: {
          config: getConfig({
            allocations: [
              { dataSource: DataSource.YAHOO, key: 'VTI', targetPercent: 80 },
              { dataSource: DataSource.YAHOO, key: 'AAPL', targetPercent: 20 }
            ],
            level: 'symbol'
          })
        },
        userId: user.id
      });

      expect(result.excludedSymbols).toContainEqual({
        dataSource: DataSource.YAHOO,
        reason: 'NO_MARKET_PRICE',
        symbol: 'AAPL'
      });
    });

    // TC-029
    it('passes the maximum number of activities to import through', async () => {
      getMaxActivitiesToImport.mockReturnValue(2);

      const result = await rebalancingService.calculate({
        user,
        calculateRebalancingDto: {
          config: getConfig({ allocations: TARGET_60_30_10 })
        },
        userId: user.id
      });

      expect(getMaxActivitiesToImport).toHaveBeenCalledWith({ user });
      expect(result.maxActivitiesToImport).toBe(2);
    });

    // TC-042
    it('does not fetch any quote if every target symbol is held', async () => {
      await rebalancingService.calculate({
        user,
        calculateRebalancingDto: {
          config: getConfig({
            allocations: [
              { dataSource: DataSource.YAHOO, key: 'VTI', targetPercent: 70 },
              { dataSource: DataSource.YAHOO, key: 'BND', targetPercent: 30 }
            ],
            level: 'symbol'
          })
        },
        userId: user.id
      });

      expect(getQuotes).not.toHaveBeenCalled();
    });
  });

  describe('models', () => {
    // SEC-03
    it('refuses a model beyond the maximum number of models of a user', async () => {
      count.mockResolvedValue(MAX_REBALANCING_MODELS);

      await expect(
        rebalancingService.create({
          createRebalancingModelDto: {
            mode: RebalancingMode.FULL,
            name: 'One too many',
            targetAllocations: {
              allocations: TARGET_60_30_10,
              level: 'assetClass'
            }
          },
          userId: user.id
        })
      ).rejects.toMatchObject({ status: 400 });

      expect(count).toHaveBeenCalledWith({ where: { userId: user.id } });
      expect(create).not.toHaveBeenCalled();
    });

    // TC-009
    it('does not reveal the model of another user', async () => {
      findFirst.mockResolvedValue(null);

      for (const call of [
        () => {
          return rebalancingService.findOne({
            id: 'model-of-user-a',
            userId: 'user-b'
          });
        },
        () => {
          return rebalancingService.update({
            id: 'model-of-user-a',
            updateRebalancingModelDto: { name: 'Hijacked' },
            userId: 'user-b'
          });
        },
        () => {
          return rebalancingService.remove({
            id: 'model-of-user-a',
            userId: 'user-b'
          });
        },
        () => {
          return rebalancingService.calculate({
            calculateRebalancingDto: { modelId: 'model-of-user-a' },
            user: { ...user, id: 'user-b' },
            userId: 'user-b'
          });
        }
      ]) {
        await expect(call()).rejects.toMatchObject({ status: 404 });
      }

      for (const [{ where }] of findFirst.mock.calls) {
        expect(where.userId).toBe('user-b');
      }

      expect(update).not.toHaveBeenCalled();
      expect(deleteRebalancingModel).not.toHaveBeenCalled();
    });

    // TC-008
    it('creates, lists, updates and deletes a model of the user', async () => {
      const record = {
        createdAt: new Date('2026-11-06'),
        feeConfig: { flatFeePerTrade: 10, percentageFee: 0.1 },
        id: 'model-id',
        mode: RebalancingMode.FULL,
        name: 'Conservative 60/40',
        targetAllocations: {
          allocations: TARGET_60_30_10,
          level: 'assetClass'
        },
        thresholdPercent: null,
        updatedAt: new Date('2026-11-06'),
        userId: user.id
      };

      create.mockResolvedValue(record);

      const created = await rebalancingService.create({
        createRebalancingModelDto: {
          feeConfig: record.feeConfig,
          mode: RebalancingMode.FULL,
          name: record.name,
          targetAllocations: {
            allocations: TARGET_60_30_10,
            level: 'assetClass'
          }
        },
        userId: user.id
      });

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Conservative 60/40',
          thresholdPercent: null,
          user: { connect: { id: user.id } }
        })
      });
      expect(created).not.toHaveProperty('userId');
      expect(created.feeConfig).toEqual(record.feeConfig);

      findMany.mockResolvedValue([record]);

      expect(
        await rebalancingService.findAll({ userId: user.id })
      ).toHaveLength(1);
      expect(findMany).toHaveBeenCalledWith({
        orderBy: { updatedAt: 'desc' },
        where: { userId: user.id }
      });

      findFirst.mockResolvedValue(record);
      update.mockResolvedValue({
        ...record,
        mode: RebalancingMode.THRESHOLD,
        name: 'Growth 80/20',
        thresholdPercent: 5
      });

      const updated = await rebalancingService.update({
        id: 'model-id',
        updateRebalancingModelDto: {
          mode: RebalancingMode.THRESHOLD,
          name: 'Growth 80/20',
          thresholdPercent: 5
        },
        userId: user.id
      });

      expect(updated.name).toBe('Growth 80/20');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'model-id', userId: user.id } })
      );

      await rebalancingService.remove({ id: 'model-id', userId: user.id });

      expect(deleteRebalancingModel).toHaveBeenCalledWith({
        where: { id: 'model-id', userId: user.id }
      });
    });

    it('defaults the fees of a model without a fee configuration', async () => {
      findFirst.mockResolvedValue({
        createdAt: new Date(),
        feeConfig: {},
        id: 'model-id',
        mode: RebalancingMode.FULL,
        name: 'Without fees',
        targetAllocations: {
          allocations: TARGET_60_30_10,
          level: 'assetClass'
        },
        thresholdPercent: null,
        updatedAt: new Date(),
        userId: user.id
      });

      const { feeConfig } = await rebalancingService.findOne({
        id: 'model-id',
        userId: user.id
      });

      expect(feeConfig).toEqual({ flatFeePerTrade: 0, percentageFee: 0 });
    });

    it('requires a threshold for the threshold mode on update', async () => {
      findFirst.mockResolvedValue({
        createdAt: new Date(),
        feeConfig: {},
        id: 'model-id',
        mode: RebalancingMode.FULL,
        name: 'Full',
        targetAllocations: {
          allocations: TARGET_60_30_10,
          level: 'assetClass'
        },
        thresholdPercent: null,
        updatedAt: new Date(),
        userId: user.id
      });

      await expect(
        rebalancingService.update({
          id: 'model-id',
          updateRebalancingModelDto: { mode: RebalancingMode.THRESHOLD },
          userId: user.id
        })
      ).rejects.toBeInstanceOf(HttpException);

      expect(update).not.toHaveBeenCalled();
    });

    it('only updates the given fields of a model', async () => {
      const record = {
        createdAt: new Date('2026-11-06'),
        feeConfig: { flatFeePerTrade: 10, percentageFee: 0.1 },
        id: 'model-id',
        mode: RebalancingMode.THRESHOLD,
        name: 'Conservative 60/40',
        targetAllocations: {
          allocations: TARGET_60_30_10,
          level: 'assetClass'
        },
        thresholdPercent: 5,
        updatedAt: new Date('2026-11-06'),
        userId: user.id
      };

      findFirst.mockResolvedValue(record);
      update.mockResolvedValue({ ...record, name: 'Renamed' });

      await rebalancingService.update({
        id: 'model-id',
        updateRebalancingModelDto: { name: 'Renamed' },
        userId: user.id
      });

      expect(update).toHaveBeenCalledWith({
        data: {
          feeConfig: undefined,
          mode: undefined,
          name: 'Renamed',
          targetAllocations: undefined,
          thresholdPercent: undefined
        },
        where: { id: 'model-id', userId: user.id }
      });

      // A switch to the full mode keeps the threshold
      await rebalancingService.update({
        id: 'model-id',
        updateRebalancingModelDto: { mode: RebalancingMode.FULL },
        userId: user.id
      });

      expect(update).toHaveBeenLastCalledWith({
        data: expect.objectContaining({
          mode: RebalancingMode.FULL,
          name: undefined,
          thresholdPercent: undefined
        }),
        where: { id: 'model-id', userId: user.id }
      });
    });

    it('rejects the removal of the threshold of a model in the threshold mode', async () => {
      findFirst.mockResolvedValue({
        createdAt: new Date(),
        feeConfig: {},
        id: 'model-id',
        mode: RebalancingMode.THRESHOLD,
        name: 'Threshold',
        targetAllocations: {
          allocations: TARGET_60_30_10,
          level: 'assetClass'
        },
        thresholdPercent: 5,
        updatedAt: new Date(),
        userId: user.id
      });

      await expect(
        rebalancingService.update({
          id: 'model-id',
          updateRebalancingModelDto: { thresholdPercent: null },
          userId: user.id
        })
      ).rejects.toMatchObject({ status: 400 });

      expect(update).not.toHaveBeenCalled();
    });

    it('stores the default fees of a model created without fees', async () => {
      create.mockResolvedValue({
        createdAt: new Date(),
        feeConfig: { flatFeePerTrade: 0, percentageFee: 0 },
        id: 'model-id',
        mode: RebalancingMode.THRESHOLD,
        name: 'Without fees',
        targetAllocations: {
          allocations: TARGET_60_30_10,
          level: 'assetClass'
        },
        thresholdPercent: 5,
        updatedAt: new Date(),
        userId: user.id
      });

      await rebalancingService.create({
        createRebalancingModelDto: {
          mode: RebalancingMode.THRESHOLD,
          name: 'Without fees',
          targetAllocations: {
            allocations: TARGET_60_30_10,
            level: 'assetClass'
          },
          thresholdPercent: 5
        },
        userId: user.id
      });

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          feeConfig: { flatFeePerTrade: 0, percentageFee: 0 },
          mode: RebalancingMode.THRESHOLD,
          thresholdPercent: 5
        })
      });
    });
  });
});
