import type { CreateOrderDto } from '@ghostfolio/common/dtos';
import type { DataSource } from '@ghostfolio/prisma/enums';

export interface TradeRecommendation {
  action: 'BUY' | 'SELL';

  /**
   * Activity which can be imported as is, all amounts in the currency of the
   * asset profile
   */
  activity: Pick<
    CreateOrderDto,
    | 'currency'
    | 'dataSource'
    | 'date'
    | 'fee'
    | 'quantity'
    | 'symbol'
    | 'type'
    | 'unitPrice'
  >;

  bucketKey: string;
  currency: string;
  currentAllocationPercent: number;
  dataSource: DataSource;
  driftPercent: number;
  estimatedFee: number;
  estimatedValue: number;
  hasInsufficientCash: boolean;
  name: string;
  quantity: number;
  symbol: string;
  targetAllocationPercent: number;
  unitPrice: number;
}
