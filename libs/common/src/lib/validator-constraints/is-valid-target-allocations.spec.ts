import type {
  AllocationTarget,
  RebalancingLevel
} from '@ghostfolio/common/interfaces';

import { getTargetAllocationsError } from './is-valid-target-allocations';

function getTargetAllocations(
  allocations: AllocationTarget[],
  level: RebalancingLevel = 'assetClass'
) {
  return { allocations, level };
}

describe('getTargetAllocationsError', () => {
  it('accepts allocations which sum up to 100', () => {
    expect(
      getTargetAllocationsError(
        getTargetAllocations([
          { key: 'EQUITY', maxPercent: 65, minPercent: 55, targetPercent: 60 },
          { key: 'FIXED_INCOME', targetPercent: 30 },
          { key: 'LIQUIDITY', targetPercent: 10 }
        ])
      )
    ).toBeUndefined();
  });

  it('accepts a sum within the tolerance', () => {
    expect(
      getTargetAllocationsError(
        getTargetAllocations([
          { key: 'EQUITY', targetPercent: 50.005 },
          { key: 'FIXED_INCOME', targetPercent: 50 }
        ])
      )
    ).toBeUndefined();
  });

  it('rejects a sum of 95', () => {
    expect(
      getTargetAllocationsError(
        getTargetAllocations([
          { key: 'EQUITY', targetPercent: 60 },
          { key: 'FIXED_INCOME', targetPercent: 25 },
          { key: 'LIQUIDITY', targetPercent: 10 }
        ])
      )
    ).toMatch(/sum up to 100 \(current sum: 95\)/);
  });

  it('rejects a sum beyond the tolerance', () => {
    expect(
      getTargetAllocationsError(
        getTargetAllocations([
          { key: 'EQUITY', targetPercent: 50.02 },
          { key: 'FIXED_INCOME', targetPercent: 50 }
        ])
      )
    ).toMatch(/sum up to 100/);
  });

  it('rejects a duplicate key', () => {
    expect(
      getTargetAllocationsError(
        getTargetAllocations([
          { key: 'EQUITY', targetPercent: 50 },
          { key: 'EQUITY', targetPercent: 50 }
        ])
      )
    ).toMatch(/"EQUITY" more than once/);
  });

  it('rejects a target percentage of 0', () => {
    expect(
      getTargetAllocationsError(
        getTargetAllocations([
          { key: 'EQUITY', targetPercent: 100 },
          { key: 'FIXED_INCOME', targetPercent: 0 }
        ])
      )
    ).toMatch(/greater than 0/);
  });

  it('rejects a minimum percentage above the target percentage', () => {
    expect(
      getTargetAllocationsError(
        getTargetAllocations([
          { key: 'EQUITY', minPercent: 70, targetPercent: 60 },
          { key: 'FIXED_INCOME', targetPercent: 40 }
        ])
      )
    ).toMatch(/minPercent of "EQUITY"/);
  });

  it('rejects a maximum percentage below the target percentage', () => {
    expect(
      getTargetAllocationsError(
        getTargetAllocations([
          { key: 'EQUITY', maxPercent: 50, targetPercent: 60 },
          { key: 'FIXED_INCOME', targetPercent: 40 }
        ])
      )
    ).toMatch(/maxPercent of "EQUITY"/);
  });

  it('requires the data source on the level symbol', () => {
    expect(
      getTargetAllocationsError(
        getTargetAllocations([{ key: 'AAPL', targetPercent: 100 }], 'symbol')
      )
    ).toMatch(/dataSource of "AAPL" is required/);

    expect(
      getTargetAllocationsError(
        getTargetAllocations(
          [{ dataSource: 'YAHOO', key: 'AAPL', targetPercent: 100 }],
          'symbol'
        )
      )
    ).toBeUndefined();
  });

  // CR-05
  it('requires an asset class as key on the level assetClass', () => {
    expect(
      getTargetAllocationsError(
        getTargetAllocations([
          { key: 'EQUITYY', targetPercent: 60 },
          { key: 'FIXED_INCOME', targetPercent: 40 }
        ])
      )
    ).toMatch(/"EQUITYY" must be an asset class/);

    expect(
      getTargetAllocationsError(
        getTargetAllocations([
          { key: 'EQUITY', targetPercent: 90 },
          { key: 'UNKNOWN', targetPercent: 10 }
        ])
      )
    ).toBeUndefined();

    // Any key is accepted on the level sector
    expect(
      getTargetAllocationsError(
        getTargetAllocations(
          [{ key: 'Technology', targetPercent: 100 }],
          'sector'
        )
      )
    ).toBeUndefined();
  });

  it('rejects empty allocations', () => {
    expect(getTargetAllocationsError(getTargetAllocations([]))).toMatch(
      /at least one allocation/
    );
  });

  it('rejects more than 200 allocations', () => {
    const allocations = Array.from({ length: 201 }, (_, index) => {
      return { key: `SYMBOL_${index}`, targetPercent: 100 / 201 };
    });

    expect(
      getTargetAllocationsError(getTargetAllocations(allocations))
    ).toMatch(/more than 200/);
  });
});
