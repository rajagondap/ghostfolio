import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

import { RebalancingConfigDto } from './create-rebalancing-model.dto';

/**
 * Either the id of a saved model or an inline configuration, exactly one of
 * both is required
 */
export class CalculateRebalancingDto {
  @IsOptional()
  @Type(() => RebalancingConfigDto)
  @ValidateNested()
  config?: RebalancingConfigDto;

  @IsOptional()
  @IsString()
  modelId?: string;
}
