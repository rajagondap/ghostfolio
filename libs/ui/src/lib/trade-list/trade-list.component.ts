import {
  getAssetProfileIdentifier,
  getLocale
} from '@ghostfolio/common/helper';
import { TradeRecommendation } from '@ghostfolio/common/interfaces';

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

import { GfValueComponent } from '../value/value.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-block' },
  imports: [
    GfValueComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatSortModule,
    MatTableModule
  ],
  selector: 'gf-trade-list',
  styleUrls: ['./trade-list.component.scss'],
  templateUrl: './trade-list.component.html'
})
export class GfTradeListComponent {
  public readonly baseCurrency = input.required<string>();
  public readonly downloadClicked = output<TradeRecommendation[]>();
  public readonly executeClicked = output<TradeRecommendation[]>();
  public readonly isExecuting = input(false);
  public readonly locale = input(getLocale(), {
    transform: (value?: string) => {
      return value ?? getLocale();
    }
  });
  public readonly maxActivitiesToImport = input(Number.MAX_SAFE_INTEGER);
  public readonly projectedLiquidityPercent = input<number | null>(null);
  public readonly selectionChange = output<TradeRecommendation[]>();
  public readonly trades = input.required<TradeRecommendation[]>();

  protected readonly dataSource = new MatTableDataSource<TradeRecommendation>(
    []
  );

  protected readonly displayedColumns = [
    'select',
    'symbol',
    'action',
    'quantity',
    'currentAllocationPercent',
    'targetAllocationPercent',
    'driftPercent',
    'estimatedValue',
    'estimatedFee'
  ];

  protected readonly selectedIds = signal(new Set<string>());

  protected readonly selectedTrades = computed(() => {
    const selectedIds = this.selectedIds();

    return this.trades().filter((trade) => {
      return selectedIds.has(this.getId(trade));
    });
  });

  protected readonly isOverLimit = computed(() => {
    return this.selectedTrades().length > this.maxActivitiesToImport();
  });

  protected readonly canSubmit = computed(() => {
    return (
      this.selectedTrades().length > 0 &&
      !this.isOverLimit() &&
      !this.isExecuting()
    );
  });

  protected readonly sort = viewChild.required(MatSort);

  protected readonly totalEstimatedFees = computed(() => {
    return this.selectedTrades().reduce((sum, { estimatedFee }) => {
      return sum + estimatedFee;
    }, 0);
  });

  public constructor() {
    // Select all trades which can be funded whenever new trades arrive
    effect(() => {
      const trades = this.trades();

      this.dataSource.data = trades;
      this.selectedIds.set(
        new Set(
          trades
            .filter(({ hasInsufficientCash }) => {
              return !hasInsufficientCash;
            })
            .map((trade) => {
              return this.getId(trade);
            })
        )
      );
    });

    effect(() => {
      this.dataSource.sort = this.sort();
    });

    effect(() => {
      this.selectionChange.emit(this.selectedTrades());
    });
  }

  protected isSelected(aTrade: TradeRecommendation) {
    return this.selectedIds().has(this.getId(aTrade));
  }

  protected onDownload() {
    this.downloadClicked.emit(this.selectedTrades());
  }

  protected onExecute() {
    this.executeClicked.emit(this.selectedTrades());
  }

  protected onToggle(aTrade: TradeRecommendation) {
    const id = this.getId(aTrade);
    const selectedIds = new Set(this.selectedIds());

    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }

    this.selectedIds.set(selectedIds);
  }

  private getId(aTrade: TradeRecommendation) {
    return getAssetProfileIdentifier(aTrade);
  }
}
