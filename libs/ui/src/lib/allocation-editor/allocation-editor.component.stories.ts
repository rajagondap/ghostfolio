import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { moduleMetadata } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';

import { GfAllocationEditorComponent } from './allocation-editor.component';

const currentAllocations = [
  { key: 'EQUITY', percent: 70 },
  { key: 'FIXED_INCOME', percent: 20 },
  { key: 'LIQUIDITY', percent: 10 }
];

export default {
  title: 'Allocation Editor',
  component: GfAllocationEditorComponent,
  decorators: [
    moduleMetadata({
      imports: [GfAllocationEditorComponent],
      providers: [
        {
          provide: ANIMATION_MODULE_TYPE,
          useValue: 'NoopAnimations'
        }
      ]
    })
  ]
} as Meta<GfAllocationEditorComponent>;

type Story = StoryObj<GfAllocationEditorComponent>;

export const Valid: Story = {
  args: {
    currentAllocations,
    allocations: [
      { key: 'EQUITY', maxPercent: 65, minPercent: 55, targetPercent: 60 },
      { key: 'FIXED_INCOME', targetPercent: 30 },
      { key: 'LIQUIDITY', targetPercent: 10 }
    ],
    level: 'assetClass',
    mode: 'FULL'
  }
};

export const InvalidTotal: Story = {
  args: {
    currentAllocations,
    allocations: [
      { key: 'EQUITY', targetPercent: 60 },
      { key: 'FIXED_INCOME', targetPercent: 25 },
      { key: 'LIQUIDITY', targetPercent: 10 }
    ],
    level: 'assetClass',
    mode: 'FULL'
  }
};

export const Empty: Story = {
  args: {
    currentAllocations,
    allocations: [],
    level: 'assetClass',
    mode: 'FULL'
  }
};

export const ThresholdWithUnlisted: Story = {
  args: {
    allocations: [{ key: 'Technology', targetPercent: 100 }],
    currentAllocations: [
      { key: 'Government', percent: 20 },
      { key: 'Technology', percent: 70 }
    ],
    level: 'sector',
    mode: 'THRESHOLD',
    thresholdPercent: 5
  }
};
