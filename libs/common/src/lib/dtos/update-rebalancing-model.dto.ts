import { IsValidTargetAllocationsConstraint } from '@ghostfolio/common/validator-constraints/is-valid-target-allocations';
import { RebalancingMode } from '@ghostfolio/prisma/enums';

import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  Validate,
  ValidateNested
} from 'class-validator';
import { isString } from 'lodash-es';

import {
  REBALANCING_MODEL_NAME_MAXIMUM_LENGTH,
  RebalancingFeeConfigDto,
  RebalancingTargetAllocationsDto
} from './create-rebalancing-model.dto';

/**
 * All fields are optional. The combination of mode and threshold of the
 * resulting model is validated by the service after merging.
 */
export class UpdateRebalancingModelDto {
  @IsOptional()
  @Type(() => RebalancingFeeConfigDto)
  @ValidateNested()
  feeConfig?: RebalancingFeeConfigDto;

  @IsEnum(RebalancingMode)
  @IsOptional()
  mode?: RebalancingMode;

  @IsOptional()
  @IsString()
  @Length(1, REBALANCING_MODEL_NAME_MAXIMUM_LENGTH)
  @Transform(({ value }: TransformFnParams) =>
    isString(value) ? value.trim() : value
  )
  name?: string;

  @IsOptional()
  @Type(() => RebalancingTargetAllocationsDto)
  @Validate(IsValidTargetAllocationsConstraint)
  @ValidateNested()
  targetAllocations?: RebalancingTargetAllocationsDto;

  @IsNumber()
  @IsOptional()
  @Max(100)
  @Min(0)
  thresholdPercent?: number | null;
}
