import { TradeRecommendation } from '@ghostfolio/common/interfaces';

import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { moduleMetadata } from '@storybook/angular';
import type { Meta, StoryObj } from '@storybook/angular';

import { GfTradeListComponent } from './trade-list.component';

function getTrade(
  aTrade: Pick<
    TradeRecommendation,
    | 'action'
    | 'bucketKey'
    | 'currentAllocationPercent'
    | 'driftPercent'
    | 'estimatedFee'
    | 'estimatedValue'
    | 'name'
    | 'quantity'
    | 'symbol'
    | 'targetAllocationPercent'
    | 'unitPrice'
  > &
    Partial<TradeRecommendation>
): TradeRecommendation {
  return {
    activity: {
      currency: 'USD',
      dataSource: 'YAHOO',
      date: '2026-11-06T10:00:00.000Z',
      fee: aTrade.estimatedFee,
      quantity: aTrade.quantity,
      symbol: aTrade.symbol,
      type: aTrade.action,
      unitPrice: aTrade.unitPrice
    },
    currency: 'USD',
    dataSource: 'YAHOO',
    hasInsufficientCash: false,
    ...aTrade
  };
}

const trades = [
  getTrade({
    action: 'SELL',
    bucketKey: 'EQUITY',
    currentAllocationPercent: 70,
    driftPercent: 10,
    estimatedFee: 18.57,
    estimatedValue: 8571.43,
    name: 'Vanguard Total Stock Market ETF',
    quantity: 34.2857,
    symbol: 'VTI',
    targetAllocationPercent: 60,
    unitPrice: 250
  }),
  getTrade({
    action: 'BUY',
    bucketKey: 'FIXED_INCOME',
    currentAllocationPercent: 20,
    driftPercent: -10,
    estimatedFee: 19.98,
    estimatedValue: 9980.02,
    name: 'Vanguard Total Bond Market ETF',
    quantity: 133.0669,
    symbol: 'BND',
    targetAllocationPercent: 30,
    unitPrice: 75
  })
];

export default {
  title: 'Trade List',
  component: GfTradeListComponent,
  decorators: [
    moduleMetadata({
      imports: [GfTradeListComponent],
      providers: [
        {
          provide: ANIMATION_MODULE_TYPE,
          useValue: 'NoopAnimations'
        }
      ]
    })
  ]
} as Meta<GfTradeListComponent>;

type Story = StoryObj<GfTradeListComponent>;

export const Default: Story = {
  args: {
    trades,
    baseCurrency: 'USD',
    locale: 'en-US',
    projectedLiquidityPercent: 9.98
  }
};

export const InsufficientCash: Story = {
  args: {
    baseCurrency: 'USD',
    locale: 'en-US',
    trades: [trades[0], { ...trades[1], hasInsufficientCash: true }]
  }
};

export const OverImportLimit: Story = {
  args: {
    trades,
    baseCurrency: 'USD',
    locale: 'en-US',
    maxActivitiesToImport: 1
  }
};
