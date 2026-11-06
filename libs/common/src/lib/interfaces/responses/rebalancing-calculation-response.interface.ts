import type { TradeRecommendation } from '@ghostfolio/common/interfaces';
import type { DataSource } from '@ghostfolio/prisma/enums';

export interface RebalancingCalculationResponse {
  baseCurrency: string;
  excludedSymbols: {
    dataSource: DataSource;
    reason: 'NO_EXCHANGE_RATE' | 'NO_MARKET_PRICE';
    symbol: string;
  }[];
  isWithinTolerance: boolean;
  maxActivitiesToImport: number;
  portfolioValueBeforeRebalancing: number;
  projectedLiquidityPercent: number | null;
  totalEstimatedFees: number;
  trades: TradeRecommendation[];
  warnings: {
    code: 'FEE_EXCEEDS_TRADE' | 'UNFILLABLE_BUCKET';
    key: string;
  }[];
}
