import { getPermissions, permissions } from '@ghostfolio/common/permissions';

describe('Permissions', () => {
  describe('Rebalancing models', () => {
    const permissionsToManageRebalancingModels = [
      permissions.createRebalancingModel,
      permissions.deleteRebalancingModel,
      permissions.readRebalancingModels,
      permissions.updateRebalancingModel
    ];

    it('Allows an administrator to manage rebalancing models', () => {
      expect(getPermissions('ADMIN')).toEqual(
        expect.arrayContaining(permissionsToManageRebalancingModels)
      );
    });

    it('Allows a user to manage rebalancing models', () => {
      expect(getPermissions('USER')).toEqual(
        expect.arrayContaining(permissionsToManageRebalancingModels)
      );
    });

    it('Allows the demo user to read rebalancing models only', () => {
      const permissionsOfDemoUser = getPermissions('DEMO');

      expect(permissionsOfDemoUser).toContain(
        permissions.readRebalancingModels
      );
      expect(permissionsOfDemoUser).not.toContain(
        permissions.createRebalancingModel
      );
      expect(permissionsOfDemoUser).not.toContain(
        permissions.deleteRebalancingModel
      );
      expect(permissionsOfDemoUser).not.toContain(
        permissions.updateRebalancingModel
      );
    });

    it('Gives an inactive user no permission for rebalancing models', () => {
      expect(getPermissions('INACTIVE')).toEqual([]);
    });
  });
});
