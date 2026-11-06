import { UNKNOWN_KEY } from '@ghostfolio/common/config';
import {
  AllocationTarget,
  LookupItem,
  RebalancingLevel
} from '@ghostfolio/common/interfaces';
import {
  getTargetAllocationsError,
  TARGET_ALLOCATIONS_SUM_TOLERANCE
} from '@ghostfolio/common/validator-constraints/is-valid-target-allocations';
import { AssetClass, RebalancingMode } from '@ghostfolio/prisma/enums';
import { translate } from '@ghostfolio/ui/i18n';
import { GfSymbolAutocompleteComponent } from '@ghostfolio/ui/symbol-autocomplete';

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, trashOutline } from 'ionicons/icons';

export interface CurrentAllocation {
  key: string;
  percent: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-block' },
  imports: [
    FormsModule,
    GfSymbolAutocompleteComponent,
    IonIcon,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule
  ],
  selector: 'gf-allocation-editor',
  styleUrls: ['./allocation-editor.component.scss'],
  templateUrl: './allocation-editor.component.html'
})
export class GfAllocationEditorComponent {
  public readonly allocations = input<AllocationTarget[]>([]);
  public readonly allocationsChange = output<AllocationTarget[]>();
  public readonly currentAllocations = input<CurrentAllocation[]>([]);
  public readonly isDisabled = input(false);
  public readonly level = input<RebalancingLevel>('assetClass');
  public readonly levelChange = output<RebalancingLevel>();
  public readonly mode = input<RebalancingMode>(RebalancingMode.FULL);
  public readonly modeChange = output<RebalancingMode>();
  public readonly thresholdPercent = input<number | null>(null);
  public readonly thresholdPercentChange = output<number | null>();
  public readonly validityChange = output<boolean>();

  public readonly assetClassOptions = computed(() => {
    const usedKeys = new Set(
      this.allocations().map(({ key }) => {
        return key;
      })
    );

    return [...Object.values(AssetClass), UNKNOWN_KEY]
      .filter((key) => {
        return !usedKeys.has(key);
      })
      .map((key) => {
        return { key, label: this.getLabel(key) };
      });
  });

  public readonly error = computed(() => {
    if (this.allocations().length === 0) {
      return undefined;
    }

    const total = this.total();

    if (Math.abs(total - 100) > TARGET_ALLOCATIONS_SUM_TOLERANCE) {
      return $localize`Total: ${this.formatPercent(total)}:total:% — must be 100%`;
    }

    return getTargetAllocationsError({
      allocations: this.allocations(),
      level: this.level()
    });
  });

  public readonly isValid = computed(() => {
    return (
      this.allocations().length > 0 &&
      (this.mode() === RebalancingMode.FULL ||
        typeof this.thresholdPercent() === 'number') &&
      getTargetAllocationsError({
        allocations: this.allocations(),
        level: this.level()
      }) === undefined
    );
  });

  public readonly levels: { label: string; value: RebalancingLevel }[] = [
    { label: $localize`Asset Class`, value: 'assetClass' },
    { label: $localize`Sector`, value: 'sector' },
    { label: $localize`Symbol`, value: 'symbol' }
  ];

  public readonly modes: { label: string; value: RebalancingMode }[] = [
    { label: $localize`Full Rebalance`, value: RebalancingMode.FULL },
    {
      label: $localize`Threshold Rebalance`,
      value: RebalancingMode.THRESHOLD
    }
  ];

  public readonly newSectorControl = new FormControl<string>('');
  public readonly newSymbolControl = new FormControl<LookupItem | null>(null);

  public readonly residualKey = computed(() => {
    return this.level() === 'assetClass' ? AssetClass.LIQUIDITY : undefined;
  });

  public readonly total = computed(() => {
    return this.allocations().reduce((sum, { targetPercent }) => {
      return sum + (targetPercent ?? 0);
    }, 0);
  });

  /**
   * Held buckets which are not part of the target allocations, hence have a
   * target of 0 % and are sold (except for the residual liquidity)
   */
  public readonly unlistedAllocations = computed(() => {
    const listedKeys = new Set(
      this.allocations().map(({ key }) => {
        return key;
      })
    );

    return this.currentAllocations().filter(({ key, percent }) => {
      return percent > 0 && !listedKeys.has(key) && key !== this.residualKey();
    });
  });

  public constructor() {
    addIcons({ addOutline, trashOutline });

    effect(() => {
      this.validityChange.emit(this.isValid());
    });
  }

  public getCurrentPercent(aKey: string) {
    return this.currentAllocations().find(({ key }) => {
      return key === aKey;
    })?.percent;
  }

  public getLabel(aKey: string) {
    if (this.level() !== 'assetClass') {
      return aKey;
    }

    return aKey === UNKNOWN_KEY ? $localize`Unknown` : translate(aKey);
  }

  public onAddAssetClass(aKey: string) {
    this.addAllocation({ key: aKey });
  }

  public onAddSector() {
    const name = this.newSectorControl.value?.trim();

    if (name) {
      this.addAllocation({ key: name });
      this.newSectorControl.reset('');
    }
  }

  public onAddSymbol() {
    const lookupItem = this.newSymbolControl.value;

    if (lookupItem?.dataSource && lookupItem?.symbol) {
      this.addAllocation({
        dataSource: lookupItem.dataSource,
        key: lookupItem.symbol
      });
      this.newSymbolControl.reset(null);
    }
  }

  public onChangeAllocation(
    aIndex: number,
    aField: 'maxPercent' | 'minPercent' | 'targetPercent',
    aValue: string
  ) {
    const value = aValue === '' ? undefined : Number(aValue);

    this.allocationsChange.emit(
      this.allocations().map((allocation, index) => {
        return index === aIndex
          ? { ...allocation, [aField]: value }
          : allocation;
      })
    );
  }

  public onChangeLevel(aLevel: RebalancingLevel) {
    this.levelChange.emit(aLevel);
    this.allocationsChange.emit([]);
  }

  public onChangeMode(aMode: RebalancingMode) {
    this.modeChange.emit(aMode);
  }

  public onChangeThresholdPercent(aValue: string) {
    this.thresholdPercentChange.emit(aValue === '' ? null : Number(aValue));
  }

  public onRemoveAllocation(aIndex: number) {
    this.allocationsChange.emit(
      this.allocations().filter((_, index) => {
        return index !== aIndex;
      })
    );
  }

  private addAllocation(
    aAllocation: Pick<AllocationTarget, 'dataSource' | 'key'>
  ) {
    if (
      this.allocations().some(({ key }) => {
        return key === aAllocation.key;
      })
    ) {
      return;
    }

    this.allocationsChange.emit([
      ...this.allocations(),
      { ...aAllocation, targetPercent: 0 }
    ]);
  }

  private formatPercent(aValue: number) {
    return Number(aValue.toFixed(2)).toString();
  }
}
