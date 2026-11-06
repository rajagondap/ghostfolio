import { AuthGuard } from '@ghostfolio/client/core/auth.guard';

import { Routes } from '@angular/router';

import { GfRebalancingPageComponent } from './rebalancing-page.component';

export const routes: Routes = [
  {
    canActivate: [AuthGuard],
    component: GfRebalancingPageComponent,
    path: '',
    title: $localize`Rebalancing`
  }
];
