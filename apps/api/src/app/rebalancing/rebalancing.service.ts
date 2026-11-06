import { ImportService } from '@ghostfolio/api/app/import/import.service';
import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { DataProviderService } from '@ghostfolio/api/services/data-provider/data-provider.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { DEFAULT_CURRENCY } from '@ghostfolio/common/config';
import {
  CalculateRebalancingDto,
  CreateRebalancingModelDto,
  UpdateRebalancingModelDto
} from '@ghostfolio/common/dtos';
import { SubscriptionType } from '@ghostfolio/common/enums';
import {
  getAssetProfileIdentifier,
  getRebalancingBucketKey,
  isCashPosition
} from '@ghostfolio/common/helper';
import {
  AllocationTarget,
  AssetProfileIdentifier,
  DataProviderResponse,
  PortfolioPosition,
  RebalancingCalculationResponse,
  RebalancingFeeConfig,
  RebalancingLevel,
  RebalancingModel,
  RebalancingTargetAllocations,
  TradeRecommendation
} from '@ghostfolio/common/interfaces';
import type { UserWithSettings } from '@ghostfolio/common/types';
import { AssetClass, RebalancingMode, Type } from '@ghostfolio/prisma/enums';

import { HttpException, Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  RebalancingModel as RebalancingModelRecord
} from '@prisma/client';
import { Big } from 'big.js';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

export type RebalancingConfig = Pick<
  RebalancingModel,
  'mode' | 'targetAllocations' | 'thresholdPercent'
> & { feeConfig?: RebalancingFeeConfig };

type CurrencyConverter = (
  aValue: number,
  aFromCurrency: string,
  aToCurrency: string
) => number;

// Relative shortfall of a sell below the held quantity, within which the
// entire holding is sold (avoids a remainder from rounding)
const HELD_QUANTITY_TOLERANCE = 1e-9;

// Drift in percentage points which is treated as no drift
const DRIFT_TOLERANCE = 0.01;

export const MAX_NOT_HELD_SYMBOLS = 50;

export const MAX_REBALANCING_MODELS = 50;

// Relative deviation between the value of a holding and its market price,
// beyond which the market price is treated as missing. The portfolio
// calculator falls back to a market price of 1 if no market data is available.
const MARKET_PRICE_TOLERANCE = 0.05;

interface Bucket {
  currentValue: Big;
  key: string;
  positions: PortfolioPosition[];
  target?: AllocationTarget;
}

interface TradeCandidate {
  bucket: Bucket;
  currency: string;
  dataSource: AssetProfileIdentifier['dataSource'];
  driftPercent: Big;
  currentPercent: Big;
  heldQuantity?: number;
  name: string;
  symbol: string;
  targetPercent: Big;
  unitPrice: number;
  valueInBaseCurrency: Big;
}

@Injectable()
export class RebalancingService {
  private readonly logger = new Logger(RebalancingService.name);

  public constructor(
    private readonly dataProviderService: DataProviderService,
    private readonly exchangeRateDataService: ExchangeRateDataService,
    private readonly importService: ImportService,
    private readonly portfolioService: PortfolioService,
    private readonly prismaService: PrismaService
  ) {}

  public async calculate({
    calculateRebalancingDto: { config, modelId },
    user,
    userId
  }: {
    calculateRebalancingDto: CalculateRebalancingDto;
    user: UserWithSettings;
    userId: string;
  }): Promise<RebalancingCalculationResponse> {
    const startTime = performance.now();

    if (!modelId === !config) {
      throw new HttpException(
        {
          error: getReasonPhrase(StatusCodes.BAD_REQUEST),
          message: ['Either modelId or config is required, but not both']
        },
        StatusCodes.BAD_REQUEST
      );
    }

    const rebalancingConfig: RebalancingConfig = modelId
      ? await this.findOne({ id: modelId, userId })
      : { ...config, thresholdPercent: config.thresholdPercent ?? null };

    const holdings = await this.portfolioService.getHoldings({
      userId,
      dateRange: 'max'
    });

    const quotes = await this.getQuotesOfNotHeldSymbols({
      holdings,
      subscriptionType: user.subscription?.type,
      targetAllocations: rebalancingConfig.targetAllocations
    });

    const baseCurrency = user.settings.settings.baseCurrency;

    const response = this.computeRebalancing({
      baseCurrency,
      holdings,
      quotes,
      config: rebalancingConfig,
      convert: (aValue, aFromCurrency, aToCurrency) => {
        return this.exchangeRateDataService.toCurrency(
          aValue,
          aFromCurrency,
          aToCurrency
        );
      },
      date: new Date().toISOString(),
      hasExchangeRate: (aFromCurrency, aToCurrency) => {
        // Same conversion paths as toCurrency(): direct or via the default
        // currency
        return (
          aFromCurrency === aToCurrency ||
          this.exchangeRateDataService.hasCurrencyPair(
            aFromCurrency,
            aToCurrency
          ) ||
          (this.exchangeRateDataService.hasCurrencyPair(
            aFromCurrency,
            DEFAULT_CURRENCY
          ) &&
            this.exchangeRateDataService.hasCurrencyPair(
              DEFAULT_CURRENCY,
              aToCurrency
            ))
        );
      },
      maxActivitiesToImport: this.importService.getMaxActivitiesToImport({
        user
      })
    });

    this.logger.log(
      `Calculated rebalancing for user ${userId} (level: ${rebalancingConfig.targetAllocations.level}, mode: ${rebalancingConfig.mode}, holdings: ${holdings.length}, trades: ${response.trades.length}, excluded: ${response.excludedSymbols.length}) in ${(performance.now() - startTime).toFixed(0)} ms`
    );

    return response;
  }

  /**
   * Calculates the trades which bring the holdings to the target allocations.
   * Pure function: all values are passed in, nothing is persisted.
   */
  public computeRebalancing({
    baseCurrency,
    config: { feeConfig, mode, targetAllocations, thresholdPercent },
    convert,
    date,
    hasExchangeRate,
    holdings,
    maxActivitiesToImport,
    quotes
  }: {
    baseCurrency: string;
    config: RebalancingConfig;
    convert: CurrencyConverter;
    date: string;
    hasExchangeRate: (aFromCurrency: string, aToCurrency: string) => boolean;
    holdings: PortfolioPosition[];
    maxActivitiesToImport: number;
    quotes: { [assetProfileIdentifier: string]: DataProviderResponse };
  }): RebalancingCalculationResponse {
    const { allocations, level } = targetAllocations;
    const flatFeePerTrade = new Big(feeConfig?.flatFeePerTrade ?? 0);
    const percentageFee = new Big(feeConfig?.percentageFee ?? 0);

    const excludedSymbols: RebalancingCalculationResponse['excludedSymbols'] =
      [];
    const warnings: RebalancingCalculationResponse['warnings'] = [];

    const positions = holdings.filter(({ quantity }) => {
      return quantity > 0;
    });

    const totalValue = positions.reduce((sum, { valueInBaseCurrency }) => {
      return sum.plus(valueInBaseCurrency ?? 0);
    }, new Big(0));

    const cashValue = positions
      .filter(({ assetProfile }) => {
        return isCashPosition(assetProfile);
      })
      .reduce((sum, { valueInBaseCurrency }) => {
        return sum.plus(valueInBaseCurrency ?? 0);
      }, new Big(0));

    const isTradeable = (aPosition: PortfolioPosition) => {
      return (
        !isCashPosition(aPosition.assetProfile) &&
        this.hasMarketPrice({ baseCurrency, convert, position: aPosition })
      );
    };

    for (const position of positions) {
      if (!isCashPosition(position.assetProfile) && !isTradeable(position)) {
        excludedSymbols.push({
          dataSource: position.assetProfile.dataSource,
          reason: 'NO_MARKET_PRICE',
          symbol: position.assetProfile.symbol
        });
      }
    }

    const buckets = this.getBuckets({ allocations, level, positions });

    // The cash settles all trades on the level of the asset class, hence the
    // liquidity reaches its target once all other asset classes are traded
    const residualBucketKey =
      level === 'assetClass' ? AssetClass.LIQUIDITY : undefined;

    let isWithinTolerance = true;
    const candidates: TradeCandidate[] = [];

    for (const [bucketId, bucket] of buckets) {
      if (bucketId === residualBucketKey) {
        continue;
      }

      const currentPercent = totalValue.eq(0)
        ? new Big(0)
        : bucket.currentValue.div(totalValue).mul(100);
      const targetPercent = new Big(bucket.target?.targetPercent ?? 0);
      const driftPercent = currentPercent.minus(targetPercent);

      if (
        !this.isOutOfTolerance({
          currentPercent,
          driftPercent,
          mode,
          targetPercent,
          thresholdPercent,
          target: bucket.target
        })
      ) {
        continue;
      }

      isWithinTolerance = false;

      const delta = totalValue
        .mul(targetPercent)
        .div(100)
        .minus(bucket.currentValue);

      const tradeablePositions = bucket.positions.filter(isTradeable);

      if (tradeablePositions.length === 0) {
        const quote = quotes[bucketId];

        if (
          level === 'symbol' &&
          delta.gt(0) &&
          bucket.target?.dataSource &&
          quote?.marketPrice > 0 &&
          // Without an exchange rate the conversion would silently be 1:1
          hasExchangeRate(quote.currency, baseCurrency)
        ) {
          // Symbol which is not held yet
          candidates.push({
            bucket,
            currentPercent,
            driftPercent,
            targetPercent,
            currency: quote.currency,
            dataSource: bucket.target.dataSource,
            name: bucket.key,
            symbol: bucket.key,
            unitPrice: quote.marketPrice,
            valueInBaseCurrency: delta
          });
        } else if (
          level === 'symbol' &&
          delta.gt(0) &&
          bucket.target?.dataSource
        ) {
          if (
            !excludedSymbols.some(({ dataSource, symbol }) => {
              return (
                dataSource === bucket.target.dataSource && symbol === bucket.key
              );
            })
          ) {
            excludedSymbols.push({
              dataSource: bucket.target.dataSource,
              reason:
                quote?.marketPrice > 0 ? 'NO_EXCHANGE_RATE' : 'NO_MARKET_PRICE',
              symbol: bucket.key
            });
          }
        } else {
          warnings.push({ code: 'UNFILLABLE_BUCKET', key: bucket.key });
        }

        continue;
      }

      const tradeableValue = tradeablePositions.reduce(
        (sum, { valueInBaseCurrency }) => {
          return sum.plus(valueInBaseCurrency ?? 0);
        },
        new Big(0)
      );

      let deltaToTrade = delta;

      if (delta.lt(0) && delta.abs().gt(tradeableValue)) {
        // Holdings without a market price cannot be sold
        deltaToTrade = tradeableValue.mul(-1);
        warnings.push({ code: 'UNFILLABLE_BUCKET', key: bucket.key });
      }

      for (const position of tradeablePositions) {
        candidates.push({
          bucket,
          currentPercent,
          driftPercent,
          targetPercent,
          currency: position.assetProfile.currency,
          dataSource: position.assetProfile.dataSource,
          heldQuantity: position.quantity,
          name: position.assetProfile.name ?? position.assetProfile.symbol,
          symbol: position.assetProfile.symbol,
          unitPrice: position.marketPrice,
          valueInBaseCurrency: tradeableValue.eq(0)
            ? new Big(0)
            : deltaToTrade
                .mul(position.valueInBaseCurrency ?? 0)
                .div(tradeableValue)
        });
      }
    }

    const trades: TradeRecommendation[] = [];
    const candidateOfTrade = new Map<TradeRecommendation, TradeCandidate>();

    for (const candidate of candidates) {
      const trade = this.getTrade({
        baseCurrency,
        candidate,
        convert,
        date,
        flatFeePerTrade,
        percentageFee
      });

      if (trade) {
        trades.push(trade);
        candidateOfTrade.set(trade, candidate);
      } else if (!candidate.valueInBaseCurrency.eq(0)) {
        warnings.push({ code: 'FEE_EXCEEDS_TRADE', key: candidate.bucket.key });
      }
    }

    const sells = trades.filter(({ action }) => {
      return action === 'SELL';
    });

    const feesOfSells = sells.reduce((sum, { estimatedFee }) => {
      return sum.plus(estimatedFee);
    }, new Big(0));

    // Fund the buys with the cash and the proceeds of the sells, starting with
    // the most underweight bucket
    let availableCash = sells.reduce(
      (sum, { estimatedFee, estimatedValue }) => {
        return sum.plus(estimatedValue).minus(estimatedFee);
      },
      cashValue
    );

    const buys = trades
      .filter(({ action }) => {
        return action === 'BUY';
      })
      .sort((a, b) => {
        return a.driftPercent - b.driftPercent;
      });

    for (const buy of buys) {
      const requiredCash = new Big(buy.estimatedValue).plus(buy.estimatedFee);

      if (requiredCash.lte(availableCash.plus(DRIFT_TOLERANCE))) {
        availableCash = availableCash.minus(requiredCash);

        continue;
      }

      // The budgets of the buys do not account for the fees of the sells, a
      // shortfall up to these fees is absorbed by a smaller buy
      const isShortfallOfFees = requiredCash
        .minus(availableCash)
        .lte(feesOfSells.plus(DRIFT_TOLERANCE));

      const reducedBuy =
        isShortfallOfFees && availableCash.gt(flatFeePerTrade)
          ? this.getTrade({
              baseCurrency,
              convert,
              date,
              flatFeePerTrade,
              percentageFee,
              candidate: {
                ...candidateOfTrade.get(buy),
                valueInBaseCurrency: availableCash
              }
            })
          : undefined;

      if (reducedBuy) {
        Object.assign(buy, reducedBuy);
        availableCash = availableCash
          .minus(reducedBuy.estimatedValue)
          .minus(reducedBuy.estimatedFee);
      } else {
        buy.hasInsufficientCash = true;
      }
    }

    const fundedTrades = trades.filter(({ hasInsufficientCash }) => {
      return !hasInsufficientCash;
    });

    const totalEstimatedFees = fundedTrades.reduce((sum, { estimatedFee }) => {
      return sum.plus(estimatedFee);
    }, new Big(0));

    let projectedLiquidityPercent: number | null = null;

    if (residualBucketKey) {
      const liquidityValue = fundedTrades.reduce(
        (sum, { action, estimatedFee, estimatedValue }) => {
          return action === 'SELL'
            ? sum.plus(estimatedValue).minus(estimatedFee)
            : sum.minus(estimatedValue).minus(estimatedFee);
        },
        buckets.get(residualBucketKey)?.currentValue ?? new Big(0)
      );

      const totalValueAfterRebalancing = totalValue.minus(totalEstimatedFees);

      projectedLiquidityPercent = totalValueAfterRebalancing.gt(0)
        ? liquidityValue.div(totalValueAfterRebalancing).mul(100).toNumber()
        : 0;
    }

    return {
      baseCurrency,
      excludedSymbols,
      isWithinTolerance,
      maxActivitiesToImport,
      projectedLiquidityPercent,
      trades,
      warnings,
      portfolioValueBeforeRebalancing: totalValue.toNumber(),
      totalEstimatedFees: totalEstimatedFees.toNumber()
    };
  }

  public async create({
    createRebalancingModelDto: {
      feeConfig,
      mode,
      name,
      targetAllocations,
      thresholdPercent
    },
    userId
  }: {
    createRebalancingModelDto: CreateRebalancingModelDto;
    userId: string;
  }): Promise<RebalancingModel> {
    const numberOfRebalancingModels =
      await this.prismaService.rebalancingModel.count({ where: { userId } });

    if (numberOfRebalancingModels >= MAX_REBALANCING_MODELS) {
      throw new HttpException(
        {
          error: getReasonPhrase(StatusCodes.BAD_REQUEST),
          message: [
            `At most ${MAX_REBALANCING_MODELS} rebalancing models are supported`
          ]
        },
        StatusCodes.BAD_REQUEST
      );
    }

    const rebalancingModel = await this.prismaService.rebalancingModel.create({
      data: {
        mode,
        name,
        feeConfig: this.getFeeConfig(
          feeConfig
        ) as unknown as Prisma.InputJsonObject,
        targetAllocations:
          targetAllocations as unknown as Prisma.InputJsonObject,
        thresholdPercent: thresholdPercent ?? null,
        user: { connect: { id: userId } }
      }
    });

    return this.toRebalancingModel(rebalancingModel);
  }

  public async findAll({
    userId
  }: {
    userId: string;
  }): Promise<RebalancingModel[]> {
    const rebalancingModels =
      await this.prismaService.rebalancingModel.findMany({
        orderBy: { updatedAt: 'desc' },
        where: { userId }
      });

    return rebalancingModels.map((rebalancingModel) => {
      return this.toRebalancingModel(rebalancingModel);
    });
  }

  public async findOne({
    id,
    userId
  }: {
    id: string;
    userId: string;
  }): Promise<RebalancingModel> {
    const rebalancingModel =
      await this.prismaService.rebalancingModel.findFirst({
        where: { id, userId }
      });

    if (!rebalancingModel) {
      throw new HttpException(
        getReasonPhrase(StatusCodes.NOT_FOUND),
        StatusCodes.NOT_FOUND
      );
    }

    return this.toRebalancingModel(rebalancingModel);
  }

  public async remove({
    id,
    userId
  }: {
    id: string;
    userId: string;
  }): Promise<void> {
    await this.findOne({ id, userId });

    await this.prismaService.rebalancingModel.delete({
      where: { id, userId }
    });
  }

  public async update({
    id,
    updateRebalancingModelDto,
    userId
  }: {
    id: string;
    updateRebalancingModelDto: UpdateRebalancingModelDto;
    userId: string;
  }): Promise<RebalancingModel> {
    const { feeConfig, mode, name, targetAllocations, thresholdPercent } =
      updateRebalancingModelDto;

    const existingRebalancingModel = await this.findOne({ id, userId });

    const resultingMode = mode ?? existingRebalancingModel.mode;
    const resultingThresholdPercent =
      thresholdPercent === undefined
        ? existingRebalancingModel.thresholdPercent
        : thresholdPercent;

    if (
      resultingMode === RebalancingMode.THRESHOLD &&
      (resultingThresholdPercent === null ||
        resultingThresholdPercent === undefined)
    ) {
      throw new HttpException(
        {
          error: getReasonPhrase(StatusCodes.BAD_REQUEST),
          message: ['thresholdPercent is required for the mode THRESHOLD']
        },
        StatusCodes.BAD_REQUEST
      );
    }

    const rebalancingModel = await this.prismaService.rebalancingModel.update({
      data: {
        mode,
        name,
        feeConfig: feeConfig
          ? (this.getFeeConfig(feeConfig) as unknown as Prisma.InputJsonObject)
          : undefined,
        targetAllocations: targetAllocations
          ? (targetAllocations as unknown as Prisma.InputJsonObject)
          : undefined,
        thresholdPercent
      },
      where: { id, userId }
    });

    return this.toRebalancingModel(rebalancingModel);
  }

  private getBucketId({
    dataSource,
    key,
    level
  }: {
    dataSource?: AssetProfileIdentifier['dataSource'];
    key: string;
    level: RebalancingLevel;
  }) {
    return level === 'symbol'
      ? getAssetProfileIdentifier({ dataSource, symbol: key })
      : key;
  }

  private getBuckets({
    allocations,
    level,
    positions
  }: {
    allocations: AllocationTarget[];
    level: RebalancingLevel;
    positions: PortfolioPosition[];
  }) {
    const buckets = new Map<string, Bucket>();

    for (const position of positions) {
      const key = getRebalancingBucketKey({
        level,
        assetProfile: position.assetProfile
      });

      if (key === undefined) {
        continue;
      }

      const bucketId = this.getBucketId({
        key,
        level,
        dataSource: position.assetProfile.dataSource
      });

      const bucket = buckets.get(bucketId) ?? {
        key,
        currentValue: new Big(0),
        positions: []
      };

      bucket.currentValue = bucket.currentValue.plus(
        position.valueInBaseCurrency ?? 0
      );
      bucket.positions.push(position);

      buckets.set(bucketId, bucket);
    }

    for (const allocation of allocations) {
      const bucketId = this.getBucketId({
        level,
        dataSource: allocation.dataSource,
        key: allocation.key
      });

      const bucket = buckets.get(bucketId) ?? {
        currentValue: new Big(0),
        key: allocation.key,
        positions: []
      };

      bucket.target = allocation;

      buckets.set(bucketId, bucket);
    }

    return buckets;
  }

  private getFeeConfig(aFeeConfig?: Partial<RebalancingFeeConfig>) {
    return {
      flatFeePerTrade: aFeeConfig?.flatFeePerTrade ?? 0,
      percentageFee: aFeeConfig?.percentageFee ?? 0
    } satisfies RebalancingFeeConfig;
  }

  private async getQuotesOfNotHeldSymbols({
    holdings,
    subscriptionType,
    targetAllocations: { allocations, level }
  }: {
    holdings: PortfolioPosition[];
    subscriptionType?: SubscriptionType;
    targetAllocations: RebalancingTargetAllocations;
  }) {
    if (level !== 'symbol') {
      return {};
    }

    const heldAssetProfileIdentifiers = new Set(
      holdings
        .filter(({ quantity }) => {
          return quantity > 0;
        })
        .map(({ assetProfile }) => {
          return getAssetProfileIdentifier(assetProfile);
        })
    );

    const items = allocations
      .filter(({ dataSource, key }) => {
        return (
          dataSource &&
          !heldAssetProfileIdentifiers.has(
            getAssetProfileIdentifier({ dataSource, symbol: key })
          )
        );
      })
      .map(({ dataSource, key }) => {
        return { dataSource, symbol: key };
      });

    if (items.length === 0) {
      return {};
    }

    if (items.length > MAX_NOT_HELD_SYMBOLS) {
      // Each symbol which is not held yet is fetched from a data provider
      throw new HttpException(
        {
          error: getReasonPhrase(StatusCodes.BAD_REQUEST),
          message: [
            `At most ${MAX_NOT_HELD_SYMBOLS} symbols which are not held yet are supported`
          ]
        },
        StatusCodes.BAD_REQUEST
      );
    }

    try {
      return await this.dataProviderService.getQuotes({
        items,
        subscriptionType
      });
    } catch (error) {
      this.logger.warn(
        `Could not fetch the quotes of ${items.length} symbols: ${error instanceof Error ? error.message : String(error)}`
      );

      return {};
    }
  }

  private getTrade({
    baseCurrency,
    candidate,
    convert,
    date,
    flatFeePerTrade,
    percentageFee
  }: {
    baseCurrency: string;
    candidate: TradeCandidate;
    convert: CurrencyConverter;
    date: string;
    flatFeePerTrade: Big;
    percentageFee: Big;
  }): TradeRecommendation | undefined {
    const isBuy = candidate.valueInBaseCurrency.gt(0);
    const grossValue = candidate.valueInBaseCurrency.abs();

    let tradeValue: Big;
    let fee: Big;
    let quantity: number;

    if (isBuy) {
      // The purchase and its fee have to fit into the budget
      tradeValue = grossValue
        .minus(flatFeePerTrade)
        .div(percentageFee.div(100).plus(1));
      fee = grossValue.minus(tradeValue);
      quantity = this.getQuantity({
        baseCurrency,
        candidate,
        convert,
        valueInBaseCurrency: tradeValue
      });
    } else {
      // The sell reaches the target, the fee reduces its proceeds
      tradeValue = grossValue;
      quantity = this.getQuantity({
        baseCurrency,
        candidate,
        convert,
        valueInBaseCurrency: tradeValue
      });

      if (
        typeof candidate.heldQuantity === 'number' &&
        quantity >= candidate.heldQuantity * (1 - HELD_QUANTITY_TOLERANCE)
      ) {
        // Never sell more than is held, the value and the market price can
        // deviate within the tolerance of the market price
        quantity = candidate.heldQuantity;
        tradeValue = new Big(
          convert(
            new Big(quantity).mul(candidate.unitPrice).toNumber(),
            candidate.currency,
            baseCurrency
          )
        );
      }

      fee = flatFeePerTrade.plus(tradeValue.mul(percentageFee).div(100));
    }

    if (tradeValue.lte(0) || (!isBuy && fee.gte(tradeValue))) {
      return undefined;
    }

    const action = isBuy ? 'BUY' : 'SELL';

    return {
      action,
      quantity,
      activity: {
        date,
        quantity,
        currency: candidate.currency,
        dataSource: candidate.dataSource,
        fee: convert(fee.toNumber(), baseCurrency, candidate.currency),
        symbol: candidate.symbol,
        type: isBuy ? Type.BUY : Type.SELL,
        unitPrice: candidate.unitPrice
      },
      bucketKey: candidate.bucket.key,
      currency: candidate.currency,
      currentAllocationPercent: candidate.currentPercent.toNumber(),
      dataSource: candidate.dataSource,
      driftPercent: candidate.driftPercent.toNumber(),
      estimatedFee: fee.toNumber(),
      estimatedValue: tradeValue.toNumber(),
      hasInsufficientCash: false,
      name: candidate.name,
      symbol: candidate.symbol,
      targetAllocationPercent: candidate.targetPercent.toNumber(),
      unitPrice: candidate.unitPrice
    };
  }

  private getQuantity({
    baseCurrency,
    candidate: { currency, unitPrice },
    convert,
    valueInBaseCurrency
  }: {
    baseCurrency: string;
    candidate: TradeCandidate;
    convert: CurrencyConverter;
    valueInBaseCurrency: Big;
  }) {
    return new Big(
      convert(valueInBaseCurrency.toNumber(), baseCurrency, currency)
    )
      .div(unitPrice)
      .toNumber();
  }

  private hasMarketPrice({
    baseCurrency,
    convert,
    position: { assetProfile, marketPrice, quantity, valueInBaseCurrency }
  }: {
    baseCurrency: string;
    convert: CurrencyConverter;
    position: PortfolioPosition;
  }) {
    if (!(marketPrice > 0)) {
      return false;
    }

    if (!valueInBaseCurrency) {
      return true;
    }

    const valueOfMarketPrice = convert(
      marketPrice * quantity,
      assetProfile.currency,
      baseCurrency
    );

    return (
      Math.abs(valueOfMarketPrice - valueInBaseCurrency) /
        valueInBaseCurrency <=
      MARKET_PRICE_TOLERANCE
    );
  }

  private isOutOfTolerance({
    currentPercent,
    driftPercent,
    mode,
    target,
    targetPercent,
    thresholdPercent
  }: {
    currentPercent: Big;
    driftPercent: Big;
    mode: RebalancingMode;
    target?: AllocationTarget;
    targetPercent: Big;
    thresholdPercent: number | null;
  }) {
    if (mode === RebalancingMode.FULL) {
      return driftPercent.abs().gt(DRIFT_TOLERANCE);
    }

    const threshold = thresholdPercent ?? 0;

    const lowerBound =
      typeof target?.minPercent === 'number'
        ? new Big(target.minPercent)
        : targetPercent.minus(threshold);
    const upperBound =
      typeof target?.maxPercent === 'number'
        ? new Big(target.maxPercent)
        : targetPercent.plus(threshold);

    return (
      currentPercent.lt(lowerBound.minus(DRIFT_TOLERANCE)) ||
      currentPercent.gt(upperBound.plus(DRIFT_TOLERANCE))
    );
  }

  private toRebalancingModel({
    createdAt,
    feeConfig,
    id,
    mode,
    name,
    targetAllocations,
    thresholdPercent,
    updatedAt
  }: RebalancingModelRecord): RebalancingModel {
    return {
      createdAt,
      id,
      mode,
      name,
      thresholdPercent,
      updatedAt,
      feeConfig: this.getFeeConfig(
        feeConfig as unknown as Partial<RebalancingFeeConfig>
      ),
      targetAllocations:
        targetAllocations as unknown as RebalancingTargetAllocations
    };
  }
}
