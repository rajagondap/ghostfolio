import { HAS_PERMISSION_KEY } from '@ghostfolio/api/decorators/has-permission.decorator';
import { REQUIRES_SCOPE_KEY } from '@ghostfolio/api/decorators/requires-scope.decorator';
import {
  CalculateRebalancingDto,
  CreateRebalancingModelDto,
  UpdateRebalancingModelDto
} from '@ghostfolio/common/dtos';
import { permissions } from '@ghostfolio/common/permissions';
import { scopes } from '@ghostfolio/common/scopes';
import type {
  ImpersonationContext,
  RequestWithUser
} from '@ghostfolio/common/types';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RebalancingController } from './rebalancing.controller';
import { RebalancingService } from './rebalancing.service';

const VALID_CONFIG = {
  mode: 'FULL',
  targetAllocations: {
    allocations: [
      { key: 'EQUITY', targetPercent: 60 },
      { key: 'FIXED_INCOME', targetPercent: 40 }
    ],
    level: 'assetClass'
  }
};

function getMetadataOfMethod<T>(metadataKey: string, methodName: string) {
  const methodsByName = RebalancingController.prototype as unknown as Record<
    string,
    object
  >;

  return Reflect.getMetadata(metadataKey, methodsByName[methodName]) as T;
}

// Validates like the global ValidationPipe of the API
async function getValidationErrors<T extends object>(
  aClass: new () => T,
  aPlain: object
) {
  return validate(plainToInstance(aClass, aPlain), {
    forbidNonWhitelisted: true,
    whitelist: true
  });
}

describe('RebalancingController', () => {
  let calculate: jest.Mock;
  let rebalancingController: RebalancingController;

  const impersonationContext = {
    userId: 'user-id'
  } as ImpersonationContext;
  const user = { id: 'user-id' } as RequestWithUser['user'];

  beforeEach(() => {
    calculate = jest.fn().mockResolvedValue({ trades: [] });

    rebalancingController = new RebalancingController(
      { calculate } as unknown as RebalancingService,
      { user } as RequestWithUser
    );
  });

  describe('calculate', () => {
    it('delegates to the service with the user of the impersonation context', async () => {
      await rebalancingController.calculate(
        { modelId: 'model-id' },
        impersonationContext
      );

      expect(calculate).toHaveBeenCalledWith({
        user,
        calculateRebalancingDto: { modelId: 'model-id' },
        userId: 'user-id'
      });
    });

    // SEC-01
    it('refuses the calculation in the restricted view', async () => {
      const controllerInRestrictedView = new RebalancingController(
        { calculate } as unknown as RebalancingService,
        {
          user: {
            ...user,
            settings: { settings: { isRestrictedView: true } }
          }
        } as RequestWithUser
      );

      await expect(
        controllerInRestrictedView.calculate(
          { modelId: 'model-id' },
          impersonationContext
        )
      ).rejects.toMatchObject({ status: 403 });

      expect(calculate).not.toHaveBeenCalled();
    });
  });

  describe('models', () => {
    it('delegates the model operations to the service with the user of the impersonation context', async () => {
      const model = { id: 'model-id', name: 'Conservative 60/40' };
      const create = jest.fn().mockResolvedValue(model);
      const findAll = jest.fn().mockResolvedValue([model]);
      const findOne = jest.fn().mockResolvedValue(model);
      const remove = jest.fn().mockResolvedValue(undefined);
      const update = jest.fn().mockResolvedValue(model);

      const controller = new RebalancingController(
        {
          create,
          findAll,
          findOne,
          remove,
          update
        } as unknown as RebalancingService,
        { user } as RequestWithUser
      );

      expect(
        await controller.getRebalancingModels(impersonationContext)
      ).toEqual({ models: [model] });
      expect(findAll).toHaveBeenCalledWith({ userId: 'user-id' });

      await controller.getRebalancingModel(impersonationContext, 'model-id');
      expect(findOne).toHaveBeenCalledWith({
        id: 'model-id',
        userId: 'user-id'
      });

      const createRebalancingModelDto = {
        ...VALID_CONFIG,
        name: 'Conservative 60/40'
      } as CreateRebalancingModelDto;

      await controller.createRebalancingModel(
        createRebalancingModelDto,
        impersonationContext
      );
      expect(create).toHaveBeenCalledWith({
        createRebalancingModelDto,
        userId: 'user-id'
      });

      await controller.updateRebalancingModel(
        { name: 'Growth 80/20' },
        impersonationContext,
        'model-id'
      );
      expect(update).toHaveBeenCalledWith({
        id: 'model-id',
        updateRebalancingModelDto: { name: 'Growth 80/20' },
        userId: 'user-id'
      });

      await controller.deleteRebalancingModel(impersonationContext, 'model-id');
      expect(remove).toHaveBeenCalledWith({
        id: 'model-id',
        userId: 'user-id'
      });
    });
  });

  // TC-039, TC-040
  describe('authorization', () => {
    it.each([
      ['calculate', permissions.readRebalancingModels, scopes.rebalancingRead],
      [
        'createRebalancingModel',
        permissions.createRebalancingModel,
        scopes.rebalancingCreate
      ],
      [
        'deleteRebalancingModel',
        permissions.deleteRebalancingModel,
        scopes.rebalancingDelete
      ],
      [
        'getRebalancingModel',
        permissions.readRebalancingModels,
        scopes.rebalancingRead
      ],
      [
        'getRebalancingModels',
        permissions.readRebalancingModels,
        scopes.rebalancingRead
      ],
      [
        'updateRebalancingModel',
        permissions.updateRebalancingModel,
        scopes.rebalancingUpdate
      ]
    ])('%s requires %s and %s', (methodName, permission, scope) => {
      expect(getMetadataOfMethod(HAS_PERMISSION_KEY, methodName)).toBe(
        permission
      );
      expect(getMetadataOfMethod(REQUIRES_SCOPE_KEY, methodName)).toEqual([
        scope
      ]);
    });
  });

  // TC-006
  describe('validation', () => {
    it('accepts a valid model', async () => {
      expect(
        await getValidationErrors(CreateRebalancingModelDto, {
          ...VALID_CONFIG,
          feeConfig: { flatFeePerTrade: 9.99, percentageFee: 0.1 },
          name: 'Conservative 60/40'
        })
      ).toEqual([]);
    });

    it('rejects a model whose allocations do not sum up to 100', async () => {
      const errors = await getValidationErrors(CreateRebalancingModelDto, {
        ...VALID_CONFIG,
        name: 'Invalid',
        targetAllocations: {
          allocations: [
            { key: 'EQUITY', targetPercent: 60 },
            { key: 'FIXED_INCOME', targetPercent: 35 }
          ],
          level: 'assetClass'
        }
      });

      expect(JSON.stringify(errors)).toMatch(/sum up to 100/);
    });

    it('rejects the threshold mode without a threshold', async () => {
      const errors = await getValidationErrors(CreateRebalancingModelDto, {
        ...VALID_CONFIG,
        mode: 'THRESHOLD',
        name: 'Without threshold'
      });

      expect(errors.map(({ property }) => property)).toContain(
        'thresholdPercent'
      );
    });

    it('rejects an empty name, a negative fee and an unknown property', async () => {
      const errors = await getValidationErrors(CreateRebalancingModelDto, {
        ...VALID_CONFIG,
        feeConfig: { flatFeePerTrade: 0, percentageFee: -1 },
        name: ' ',
        unknownProperty: true
      });

      expect(errors.map(({ property }) => property).sort()).toEqual([
        'feeConfig',
        'name',
        'unknownProperty'
      ]);
    });

    it('limits the name to 100 characters', async () => {
      expect(
        await getValidationErrors(CreateRebalancingModelDto, {
          ...VALID_CONFIG,
          name: 'a'.repeat(100)
        })
      ).toEqual([]);

      const errors = await getValidationErrors(CreateRebalancingModelDto, {
        ...VALID_CONFIG,
        name: 'a'.repeat(101)
      });

      expect(errors.map(({ property }) => property)).toEqual(['name']);
    });

    it('rejects a threshold and a percentage fee beyond 100', async () => {
      const errors = await getValidationErrors(CreateRebalancingModelDto, {
        ...VALID_CONFIG,
        feeConfig: { flatFeePerTrade: 0, percentageFee: 101 },
        mode: 'THRESHOLD',
        name: 'Beyond 100',
        thresholdPercent: 101
      });

      expect(errors.map(({ property }) => property).sort()).toEqual([
        'feeConfig',
        'thresholdPercent'
      ]);
    });

    // SEC-05
    it('rejects a flat fee beyond its maximum', async () => {
      const errors = await getValidationErrors(CreateRebalancingModelDto, {
        ...VALID_CONFIG,
        feeConfig: { flatFeePerTrade: 1e12, percentageFee: 0 },
        name: 'Huge fee'
      });

      expect(errors.map(({ property }) => property)).toEqual(['feeConfig']);
    });

    it('accepts a partial update and validates its fields', async () => {
      expect(
        await getValidationErrors(UpdateRebalancingModelDto, {
          name: 'Growth 80/20'
        })
      ).toEqual([]);

      expect(
        await getValidationErrors(UpdateRebalancingModelDto, {
          thresholdPercent: null
        })
      ).toEqual([]);

      const errors = await getValidationErrors(UpdateRebalancingModelDto, {
        name: ' ',
        targetAllocations: {
          allocations: [{ key: 'EQUITY', targetPercent: 95 }],
          level: 'assetClass'
        }
      });

      expect(errors.map(({ property }) => property).sort()).toEqual([
        'name',
        'targetAllocations'
      ]);
    });

    it('validates the nested configuration of a calculation', async () => {
      expect(
        await getValidationErrors(CalculateRebalancingDto, {
          config: VALID_CONFIG
        })
      ).toEqual([]);

      expect(
        await getValidationErrors(CalculateRebalancingDto, {
          config: { ...VALID_CONFIG, mode: 'UNKNOWN' }
        })
      ).not.toEqual([]);
    });
  });
});
