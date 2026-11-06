import type { DataSource } from '@ghostfolio/prisma/enums';

export type RebalancingLevel = 'assetClass' | 'sector' | 'symbol';

export interface AllocationTarget {
  dataSource?: DataSource;
  key: string;
  maxPercent?: number;
  minPercent?: number;
  targetPercent: number;
}

export interface RebalancingFeeConfig {
  flatFeePerTrade: number;
  percentageFee: number;
}

export interface RebalancingTargetAllocations {
  allocations: AllocationTarget[];
  level: RebalancingLevel;
}
