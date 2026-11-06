import type { RebalancingLevel } from '@ghostfolio/common/interfaces';
import {
  IsValidTargetAllocationsConstraint,
  MAX_TARGET_ALLOCATIONS
} from '@ghostfolio/common/validator-constraints/is-valid-target-allocations';
import { DataSource, RebalancingMode } from '@ghostfolio/prisma/enums';

import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidateNested
} from 'class-validator';
import { isString } from 'lodash-es';

export const REBALANCING_LEVELS: RebalancingLevel[] = [
  'assetClass',
  'sector',
  'symbol'
];

export const REBALANCING_MODEL_NAME_MAXIMUM_LENGTH = 100;

export class AllocationTargetDto {
  @IsEnum(DataSource)
  @IsOptional()
  dataSource?: DataSource;

  @IsString()
  @Length(1, 100)
  key: string;

  @IsNumber()
  @IsOptional()
  @Max(100)
  @Min(0)
  maxPercent?: number;

  @IsNumber()
  @IsOptional()
  @Max(100)
  @Min(0)
  minPercent?: number;

  @IsNumber()
  @Max(100)
  @Min(0)
  targetPercent: number;
}

export const REBALANCING_FLAT_FEE_MAXIMUM = 1_000_000_000;

export class RebalancingFeeConfigDto {
  @IsNumber()
  @Max(REBALANCING_FLAT_FEE_MAXIMUM)
  @Min(0)
  flatFeePerTrade: number;

  @IsNumber()
  @Max(100)
  @Min(0)
  percentageFee: number;
}

export class RebalancingTargetAllocationsDto {
  @ArrayMaxSize(MAX_TARGET_ALLOCATIONS)
  @ArrayMinSize(1)
  @IsArray()
  @Type(() => AllocationTargetDto)
  @ValidateNested({ each: true })
  allocations: AllocationTargetDto[];

  @IsIn(REBALANCING_LEVELS)
  level: RebalancingLevel;
}

/**
 * Configuration of a rebalancing, which is either saved as a model or
 * calculated inline
 */
export class RebalancingConfigDto {
  @IsOptional()
  @Type(() => RebalancingFeeConfigDto)
  @ValidateNested()
  feeConfig?: RebalancingFeeConfigDto;

  @IsEnum(RebalancingMode)
  mode: RebalancingMode;

  @Type(() => RebalancingTargetAllocationsDto)
  @Validate(IsValidTargetAllocationsConstraint)
  @ValidateNested()
  targetAllocations: RebalancingTargetAllocationsDto;

  @IsNumber()
  @Max(100)
  @Min(0)
  @ValidateIf(({ mode, thresholdPercent }: RebalancingConfigDto) => {
    return (
      mode === RebalancingMode.THRESHOLD ||
      (thresholdPercent !== null && thresholdPercent !== undefined)
    );
  })
  thresholdPercent?: number | null;
}

export class CreateRebalancingModelDto extends RebalancingConfigDto {
  @IsString()
  @Length(1, REBALANCING_MODEL_NAME_MAXIMUM_LENGTH)
  @Transform(({ value }: TransformFnParams) =>
    isString(value) ? value.trim() : value
  )
  name: string;
}
