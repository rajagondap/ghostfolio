import { ImpersonationStorageService } from '@ghostfolio/client/services/impersonation-storage.service';
import { ImportActivitiesService } from '@ghostfolio/client/services/import-activities.service';
import { UserService } from '@ghostfolio/client/services/user/user.service';
import { CreateOrderDto } from '@ghostfolio/common/dtos';
import { ConfirmationDialogType } from '@ghostfolio/common/enums';
import {
  downloadAsFile,
  getRebalancingBucketKey
} from '@ghostfolio/common/helper';
import {
  AllocationTarget,
  PortfolioPosition,
  RebalancingCalculationResponse,
  RebalancingLevel,
  RebalancingModel,
  TradeRecommendation,
  User
} from '@ghostfolio/common/interfaces';
import { hasPermission, permissions } from '@ghostfolio/common/permissions';
import { internalRoutes } from '@ghostfolio/common/routes/routes';
import { AccountWithPlatform } from '@ghostfolio/common/types';
import { RebalancingMode } from '@ghostfolio/prisma/enums';
import { GfAccountSelectorComponent } from '@ghostfolio/ui/account-selector';
import {
  CurrentAllocation,
  GfAllocationEditorComponent
} from '@ghostfolio/ui/allocation-editor';
import { NotificationService } from '@ghostfolio/ui/notifications';
import { DataService } from '@ghostfolio/ui/services';
import { GfTradeListComponent } from '@ghostfolio/ui/trade-list';

import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { format } from 'date-fns';
import { StatusCodes } from 'http-status-codes';
import ms from 'ms';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page' },
  imports: [
    GfAccountSelectorComponent,
    GfAllocationEditorComponent,
    GfTradeListComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    RouterModule
  ],
  selector: 'gf-rebalancing-page',
  styleUrls: ['./rebalancing-page.scss'],
  templateUrl: './rebalancing-page.html'
})
export class GfRebalancingPageComponent implements OnInit {
  protected readonly accountIdControl = new FormControl<string | null>(null);
  protected readonly accounts = signal<AccountWithPlatform[]>([]);
  protected readonly allocations = signal<AllocationTarget[]>([]);
  protected readonly calculation =
    signal<RebalancingCalculationResponse | null>(null);
  protected readonly activitiesRouterLink =
    internalRoutes.portfolio.subRoutes.activities.routerLink;
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly flatFeePerTrade = signal(0);
  protected readonly hasFailedImport = signal(false);
  protected readonly hasImpersonationId = signal(false);
  protected readonly holdings = signal<PortfolioPosition[]>([]);
  protected readonly isCalculating = signal(false);
  protected readonly isExecuting = signal(false);
  protected readonly isRecalculating = signal(false);
  protected readonly isValid = signal(false);
  protected readonly level = signal<RebalancingLevel>('assetClass');
  protected readonly mode = signal<RebalancingMode>(RebalancingMode.FULL);
  protected readonly models = signal<RebalancingModel[]>([]);
  protected readonly percentageFee = signal(0);
  protected readonly selectedModel = signal<RebalancingModel | null>(null);
  protected readonly thresholdPercent = signal<number | null>(null);
  protected readonly user = signal<User | null>(null);

  protected readonly canManageModels = computed(() => {
    return hasPermission(
      this.user()?.permissions,
      permissions.createRebalancingModel
    );
  });

  protected readonly currentAllocations = computed<CurrentAllocation[]>(() => {
    return this.getCurrentAllocations({
      holdings: this.holdings(),
      level: this.level()
    });
  });

  protected readonly isReadOnly = computed(() => {
    return (
      this.hasImpersonationId() ||
      !!this.user()?.settings?.isRestrictedView ||
      !hasPermission(
        this.user()?.permissions,
        permissions.readRebalancingModels
      )
    );
  });

  private readonly dataService = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly importActivitiesService = inject(ImportActivitiesService);
  private readonly impersonationStorageService = inject(
    ImpersonationStorageService
  );
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly userService = inject(UserService);

  public ngOnInit() {
    this.impersonationStorageService
      .onChangeHasImpersonation()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((impersonationId) => {
        this.hasImpersonationId.set(!!impersonationId);
      });

    this.userService.stateChanged
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        if (state?.user) {
          this.user.set(state.user);
        }
      });

    this.fetchHoldings();
    this.fetchModels();

    this.dataService
      .fetchAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ accounts }) => {
        this.accounts.set(accounts);
      });
  }

  protected onAllocationsChange(aAllocations: AllocationTarget[]) {
    this.allocations.set(aAllocations);
    this.calculation.set(null);
  }

  protected onCalculate() {
    this.errorMessage.set(null);
    this.isCalculating.set(true);
    this.isRecalculating.set(false);

    this.dataService
      .postRebalancingCalculation({ config: this.getConfig() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (error: HttpErrorResponse) => {
          this.isCalculating.set(false);

          if (error.status === StatusCodes.SERVICE_UNAVAILABLE) {
            // The portfolio snapshot is computed after a change of activities
            this.isRecalculating.set(true);
          } else {
            this.errorMessage.set(this.getErrorMessage(error));
          }
        },
        next: (calculation) => {
          this.calculation.set(calculation);
          this.isCalculating.set(false);
        }
      });
  }

  protected onDeleteModel() {
    const model = this.selectedModel();

    if (!model) {
      return;
    }

    this.notificationService.confirm({
      confirmFn: () => {
        this.dataService
          .deleteRebalancingModel(model.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(() => {
            this.onNewModel();
            this.fetchModels();
          });
      },
      confirmType: ConfirmationDialogType.Warn,
      title: $localize`Do you really want to delete this rebalancing model?`
    });
  }

  protected onDownload(aTrades: TradeRecommendation[]) {
    const date = new Date();

    downloadAsFile({
      content: {
        activities: this.getActivities({ trades: aTrades }),
        meta: { date: date.toISOString() }
      },
      contentType: 'application/json',
      fileName: `ghostfolio-rebalancing-${format(date, 'yyyyMMddHHmm')}.json`,
      format: 'json'
    });
  }

  protected onExecute(aTrades: TradeRecommendation[]) {
    const calculation = this.calculation();

    if (!calculation || aTrades.length === 0) {
      return;
    }

    const totalFees = aTrades.reduce((sum, { estimatedFee }) => {
      return sum + estimatedFee;
    }, 0);

    const netChange = aTrades.reduce((sum, { action, estimatedValue }) => {
      return action === 'BUY' ? sum + estimatedValue : sum - estimatedValue;
    }, 0);

    this.notificationService.confirm({
      confirmFn: () => {
        void this.execute(aTrades);
      },
      confirmLabel: $localize`Execute Rebalancing`,
      confirmType: ConfirmationDialogType.Warn,
      message: [
        $localize`This will create ${aTrades.length}:count: activities in your portfolio. This cannot be undone in bulk.`,
        $localize`Net change of invested value: ${this.formatAmount(netChange)}:netChange: ${calculation.baseCurrency}:currency:`,
        $localize`Estimated fees: ${this.formatAmount(totalFees)}:fees: ${calculation.baseCurrency}:currency:`
      ].join(' '),
      title: $localize`Create ${aTrades.length}:count: activities?`
    });
  }

  protected onLevelChange(aLevel: RebalancingLevel) {
    this.level.set(aLevel);
    this.calculation.set(null);
  }

  protected onLoadModel(aModelId: string) {
    const model = this.models().find(({ id }) => {
      return id === aModelId;
    });

    if (!model) {
      this.onNewModel();
      return;
    }

    this.selectedModel.set(model);
    this.level.set(model.targetAllocations.level);
    this.allocations.set(model.targetAllocations.allocations);
    this.mode.set(model.mode);
    this.thresholdPercent.set(model.thresholdPercent);
    this.flatFeePerTrade.set(model.feeConfig.flatFeePerTrade);
    this.percentageFee.set(model.feeConfig.percentageFee);
    this.calculation.set(null);
  }

  protected onModeChange(aMode: RebalancingMode) {
    this.mode.set(aMode);
    this.calculation.set(null);
  }

  protected onNewModel() {
    this.selectedModel.set(null);
    this.level.set('assetClass');
    this.allocations.set([]);
    this.mode.set(RebalancingMode.FULL);
    this.thresholdPercent.set(null);
    this.flatFeePerTrade.set(0);
    this.percentageFee.set(0);
    this.calculation.set(null);
  }

  protected onFeeChange(
    aField: 'flatFeePerTrade' | 'percentageFee',
    aValue: string
  ) {
    const value = Math.max(0, Number(aValue) || 0);

    if (aField === 'flatFeePerTrade') {
      this.flatFeePerTrade.set(value);
    } else {
      this.percentageFee.set(value);
    }

    this.calculation.set(null);
  }

  protected onRenameModel() {
    const model = this.selectedModel();

    if (!model) {
      return;
    }

    this.notificationService.prompt({
      confirmFn: (value) => {
        const name = value?.trim();

        if (!name) {
          return;
        }

        this.dataService
          .putRebalancingModel(model.id, { name })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            error: (error: HttpErrorResponse) => {
              this.errorMessage.set(this.getErrorMessage(error));
            },
            next: (updatedModel) => {
              this.selectedModel.set(updatedModel);
              this.fetchModels();
            }
          });
      },
      defaultValue: model.name,
      title: $localize`Rename rebalancing model`,
      valueLabel: $localize`Name`
    });
  }

  protected onSaveModel() {
    const model = this.selectedModel();
    const { feeConfig, mode, targetAllocations, thresholdPercent } =
      this.getConfig();

    if (model) {
      this.dataService
        .putRebalancingModel(model.id, {
          feeConfig,
          mode,
          targetAllocations,
          thresholdPercent
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          error: (error: HttpErrorResponse) => {
            this.errorMessage.set(this.getErrorMessage(error));
          },
          next: (updatedModel) => {
            this.selectedModel.set(updatedModel);
            this.fetchModels();
            this.showMessage($localize`The rebalancing model has been saved.`);
          }
        });

      return;
    }

    this.notificationService.prompt({
      confirmFn: (value) => {
        const name = value?.trim();

        if (!name) {
          return;
        }

        this.dataService
          .postRebalancingModel({
            feeConfig,
            mode,
            name,
            targetAllocations,
            thresholdPercent
          })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            error: (error: HttpErrorResponse) => {
              this.errorMessage.set(this.getErrorMessage(error));
            },
            next: (createdModel) => {
              this.selectedModel.set(createdModel);
              this.fetchModels();
              this.showMessage(
                $localize`The rebalancing model has been saved.`
              );
            }
          });
      },
      title: $localize`Save rebalancing model`,
      valueLabel: $localize`Name`
    });
  }

  protected onThresholdPercentChange(aThresholdPercent: number | null) {
    this.thresholdPercent.set(aThresholdPercent);
    this.calculation.set(null);
  }

  private async execute(aTrades: TradeRecommendation[]) {
    const activities = this.getActivities({
      accountId: this.accountIdControl.value ?? undefined,
      trades: aTrades
    });

    let isImporting = false;

    this.errorMessage.set(null);
    this.hasFailedImport.set(false);
    this.isExecuting.set(true);

    try {
      // Validate everything first, nothing is written by the dry run
      const { activities: activitiesOfDryRun } =
        await this.importActivitiesService.importJson({
          activities,
          isDryRun: true
        });

      const activitiesWithError = activitiesOfDryRun.filter(({ error }) => {
        return !!error;
      });

      if (activitiesWithError.length > 0) {
        this.errorMessage.set(
          $localize`Nothing has been imported. The following activities are not valid (e.g. duplicates): ${activitiesWithError
            .map(({ assetProfile }) => {
              return assetProfile?.symbol;
            })
            .join(', ')}:symbols:`
        );

        return;
      }

      isImporting = true;

      const { activities: importedActivities } =
        await this.importActivitiesService.importJson({ activities });

      this.calculation.set(null);
      this.fetchHoldings();

      this.snackBar
        .open(
          $localize`${importedActivities.length}:count: activities have been created.`,
          $localize`Activities`,
          { duration: ms('5 seconds') }
        )
        .onAction()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          void this.router.navigate(this.activitiesRouterLink);
        });
    } catch (error) {
      this.errorMessage.set(this.getErrorMessage(error as HttpErrorResponse));

      // The import is not rolled back on an error, some activities may have
      // been created already
      this.hasFailedImport.set(isImporting);
    } finally {
      this.isExecuting.set(false);
    }
  }

  private fetchHoldings() {
    this.dataService
      .fetchPortfolioHoldings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ holdings }) => {
        this.holdings.set(holdings);
      });
  }

  private fetchModels() {
    this.dataService
      .fetchRebalancingModels()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ models }) => {
        this.models.set(models);
      });
  }

  private formatAmount(aValue: number) {
    return aValue.toLocaleString(this.user()?.settings?.locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    });
  }

  private getActivities({
    accountId,
    trades
  }: {
    accountId?: string;
    trades: TradeRecommendation[];
  }): CreateOrderDto[] {
    const comment = $localize`Rebalancing: ${this.selectedModel()?.name ?? $localize`unsaved`}:name:`;

    // The server prepared the activities, no amount is derived here
    return trades.map(({ activity }) => {
      return { ...activity, accountId, comment };
    });
  }

  private getConfig() {
    return {
      feeConfig: {
        flatFeePerTrade: this.flatFeePerTrade(),
        percentageFee: this.percentageFee()
      },
      mode: this.mode(),
      targetAllocations: {
        allocations: this.allocations(),
        level: this.level()
      },
      thresholdPercent:
        this.mode() === RebalancingMode.THRESHOLD
          ? this.thresholdPercent()
          : null
    };
  }

  /**
   * Current allocation per bucket for display in the editor, the server
   * derives the buckets on its own for the calculation
   */
  private getCurrentAllocations({
    holdings,
    level
  }: {
    holdings: PortfolioPosition[];
    level: RebalancingLevel;
  }): CurrentAllocation[] {
    const positions = holdings.filter(({ quantity }) => {
      return quantity > 0;
    });

    const totalValue = positions.reduce((sum, { valueInBaseCurrency }) => {
      return sum + (valueInBaseCurrency ?? 0);
    }, 0);

    if (totalValue <= 0) {
      return [];
    }

    const valueByKey = new Map<string, number>();

    for (const { assetProfile, valueInBaseCurrency } of positions) {
      const key = getRebalancingBucketKey({ assetProfile, level });

      if (key) {
        valueByKey.set(
          key,
          (valueByKey.get(key) ?? 0) + (valueInBaseCurrency ?? 0)
        );
      }
    }

    return [...valueByKey.entries()].map(([key, value]) => {
      return { key, percent: (value / totalValue) * 100 };
    });
  }

  private getErrorMessage(aError: HttpErrorResponse) {
    const message = (aError?.error as { message?: string[] | string })?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    return message ?? $localize`Oops, something went wrong.`;
  }

  private showMessage(aMessage: string) {
    this.snackBar.open(aMessage, undefined, { duration: ms('3 seconds') });
  }
}
