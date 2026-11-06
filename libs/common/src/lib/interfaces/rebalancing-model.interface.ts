import type { RebalancingMode } from '@ghostfolio/prisma/enums';

import type {
  RebalancingFeeConfig,
  RebalancingTargetAllocations
} from './allocation-target.interface';

export interface RebalancingModel {
  createdAt: Date;
  feeConfig: RebalancingFeeConfig;
  id: string;
  mode: RebalancingMode;
  name: string;
  targetAllocations: RebalancingTargetAllocations;
  thresholdPercent: number | null;
  updatedAt: Date;
}
