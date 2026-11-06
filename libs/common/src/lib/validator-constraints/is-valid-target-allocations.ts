import { UNKNOWN_KEY } from '@ghostfolio/common/config';
import type { RebalancingTargetAllocations } from '@ghostfolio/common/interfaces';
import { AssetClass } from '@ghostfolio/prisma/enums';

import { Big } from 'big.js';
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator';

// Holdings without an asset class are bucketed as unknown
const ASSET_CLASS_KEYS: string[] = [...Object.values(AssetClass), UNKNOWN_KEY];

export const MAX_TARGET_ALLOCATIONS = 200;

// Tolerance of the sum of all target percentages, e.g. to allow 33.33 * 3
export const TARGET_ALLOCATIONS_SUM_TOLERANCE = 0.01;

/**
 * Returns a description of the first violated rule, or undefined if the
 * target allocations are valid
 */
export function getTargetAllocationsError(
  aTargetAllocations: RebalancingTargetAllocations
): string | undefined {
  const allocations = aTargetAllocations?.allocations;

  if (!Array.isArray(allocations) || allocations.length === 0) {
    return 'allocations must contain at least one allocation';
  }

  if (allocations.length > MAX_TARGET_ALLOCATIONS) {
    return `allocations must not contain more than ${MAX_TARGET_ALLOCATIONS} allocations`;
  }

  const keys = new Set<string>();
  let sum = new Big(0);

  for (const {
    dataSource,
    key,
    maxPercent,
    minPercent,
    targetPercent
  } of allocations) {
    if (keys.has(key)) {
      return `allocations must not contain the key "${key}" more than once`;
    }

    keys.add(key);

    if (
      aTargetAllocations.level === 'assetClass' &&
      !ASSET_CLASS_KEYS.includes(key)
    ) {
      return `key "${key}" must be an asset class on the level assetClass`;
    }

    if (
      typeof targetPercent !== 'number' ||
      targetPercent <= 0 ||
      targetPercent > 100
    ) {
      return `targetPercent of "${key}" must be greater than 0 and at most 100`;
    }

    if (typeof minPercent === 'number' && minPercent > targetPercent) {
      return `minPercent of "${key}" must not be greater than targetPercent`;
    }

    if (typeof maxPercent === 'number' && maxPercent < targetPercent) {
      return `maxPercent of "${key}" must not be less than targetPercent`;
    }

    if (aTargetAllocations.level === 'symbol' && !dataSource) {
      return `dataSource of "${key}" is required for the level symbol`;
    }

    sum = sum.plus(targetPercent);
  }

  if (sum.minus(100).abs().gt(TARGET_ALLOCATIONS_SUM_TOLERANCE)) {
    return `allocations must sum up to 100 (current sum: ${sum.toString()})`;
  }

  return undefined;
}

@ValidatorConstraint({ name: 'isValidTargetAllocations' })
export class IsValidTargetAllocationsConstraint implements ValidatorConstraintInterface {
  public defaultMessage({ value }: ValidationArguments) {
    return (
      getTargetAllocationsError(value as RebalancingTargetAllocations) ??
      'targetAllocations are not valid'
    );
  }

  public validate(value: unknown) {
    return (
      getTargetAllocationsError(value as RebalancingTargetAllocations) ===
      undefined
    );
  }
}
